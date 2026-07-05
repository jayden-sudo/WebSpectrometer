// Core data flow, ported from Module_Spectrometer.vb (§11)
// Step-by-step mapping of ProcessCapturedImage → Spectrometer_ProcessReceivedSamples

import { type Calibration, nmRange, nmToBin, interpolate } from './calibration'

export interface IrradianceCoeffs {
  nms: number[]
  coeffs: number[]
}

export interface PipelineParams {
  averageEnabled: boolean
  averageCount: number // Target frame count (dropdown value)
  spatialAveraging: number // 0~10
  risingSpeed: number // 0~100
  fallingSpeed: number // 0~100
  referenceEnabled: boolean
  backgroundEnabled: boolean
  // ⑤ Scale unification: WebCam = 256; TCD = 65536/2^ADCbits (default 256)
  scaleCoeff?: number
  // ⑥ TCD subtracts AdcMin (already converted to this scale); WebCam = 0
  adcMinScaled?: number
  // Visible window (per-mille): Reference's MaxRef takes the maximum within this window (AddReference)
  startX?: number
  endX?: number
}

export interface PipelineState {
  numSamples: number
  // ⑤ Average accumulation array and counter
  averaged: Float64Array
  averageCounter: number
  averageDone: boolean // This frame reached the target (triggers sound + save)
  // ⑦ Rising/Falling IIR current values
  iir: Float64Array
  // ⑧ Calibration resampling result
  resampled: Float64Array
  // ⑨ Spatial filtering (data source for saving; ⑩⑪ also write back into this array)
  spatialFiltered: Float64Array
  // Snapshots
  reference: Float64Array | null
  background: Float64Array | null
  nmMin: number
  nmMax: number
  // Hot-path caches (reused every frame to avoid GC jitter)
  work: Float64Array
  visibleScratch: Float64Array
  // Calibration resampling bin lookup table + irradiance coefficient table: rebuilt only when the calibration/irradiance object changes
  binLut: Int32Array
  lutCalibration: Calibration | null
  coeffLut: Float64Array | null
  lutIrradiance: IrradianceCoeffs | null
}

export function createPipelineState(numSamples: number): PipelineState {
  return {
    numSamples,
    averaged: new Float64Array(numSamples),
    averageCounter: 0,
    averageDone: false,
    iir: new Float64Array(numSamples),
    resampled: new Float64Array(numSamples),
    spatialFiltered: new Float64Array(numSamples),
    reference: null,
    background: null,
    nmMin: 0,
    nmMax: 0,
    work: new Float64Array(numSamples),
    visibleScratch: new Float64Array(numSamples),
    binLut: new Int32Array(numSamples),
    lutCalibration: null,
    coeffLut: null,
    lutIrradiance: null,
  }
}

// ①②③ the caller obtains ROI brightness (0~255); here we perform ④→⑪
export function processFrame(
  state: PipelineState,
  received: Float64Array, // Array_ReceivedSamples, 0~255
  params: PipelineParams,
  calibration: Calibration,
  irradiance: IrradianceCoeffs | null,
): void {
  const n = state.numSamples
  const work = state.work

  const { nmMin, nmMax } = nmRange(calibration, n)
  state.nmMin = nmMin
  state.nmMax = nmMax

  // LUT rebuild: when the calibration/irradiance object identity changes (setCalibration creates a new object each time)
  if (state.lutCalibration !== calibration) {
    state.lutCalibration = calibration
    const lut = state.binLut
    for (let i = 0; i < n; i++) {
      const nm = nmMin + ((nmMax - nmMin) * i) / n
      let bin = Math.round(nmToBin(calibration, nm))
      if (bin < 0) bin = 0
      else if (bin > n - 1) bin = n - 1
      lut[i] = bin
    }
    state.lutIrradiance = null // The nm axis changed, so rebuild the irradiance table too
  }
  if (irradiance !== state.lutIrradiance) {
    state.lutIrradiance = irradiance
    if (irradiance) {
      const coeffs = new Float64Array(n)
      for (let i = 0; i < n; i++) {
        const nm = nmMin + ((nmMax - nmMin) * i) / n
        coeffs[i] = interpolate(irradiance.nms, irradiance.coeffs, nm)
      }
      state.coeffLut = coeffs
    } else {
      state.coeffLut = null
    }
  }

  // ④ Irradiance coefficient correction (on raw samples) + ⑤ scale unification → 0~65535
  // Order matches VB: CorrectForIrradiance → ×ScaleCoeff → Average → only after averaging subtract AdcMin and clamp to 0
  const scale = params.scaleCoeff ?? 256
  const adcMin = params.adcMinScaled ?? 0
  const coeffLut = state.coeffLut
  if (coeffLut) {
    for (let i = 0; i < n; i++) work[i] = received[i] * coeffLut[i] * scale
  } else {
    for (let i = 0; i < n; i++) work[i] = received[i] * scale
  }

  // ⑤ Average: enabled and counter ≥1 → accumulate; otherwise overwrite
  state.averageDone = false
  if (params.averageEnabled) {
    if (state.averageCounter >= 1) {
      for (let i = 0; i < n; i++) state.averaged[i] += work[i]
      state.averageCounter++
    } else {
      state.averaged.set(work)
      state.averageCounter = 1
    }
    const c = state.averageCounter
    for (let i = 0; i < n; i++) work[i] = state.averaged[i] / c
    if (c >= params.averageCount) {
      state.averageDone = true
      state.averageCounter = 0
    }
  } else {
    state.averageCounter = 0
  }

  // ⑥ After averaging, subtract AdcMin and clamp to 0 (VB 568-571)
  if (adcMin !== 0) {
    for (let i = 0; i < n; i++) {
      const v = work[i] - adcMin
      work[i] = v < 0 ? 0 : v
    }
  }

  // ⑦ Rising/Falling IIR: K = (speed/100)^1.5
  const kUp = Math.pow(params.risingSpeed / 100, 1.5)
  const kDw = Math.pow(params.fallingSpeed / 100, 1.5)
  const iir = state.iir
  for (let i = 0; i < n; i++) {
    const v = work[i]
    const cur = iir[i]
    iir[i] = cur + (v - cur) * (v > cur ? kUp : kDw)
  }

  // ⑧ Calibration resampling → linearly equidistant in nm (bin mapping uses the LUT)
  const resampled = state.resampled
  const binLut = state.binLut
  for (let i = 0; i < n; i++) {
    resampled[i] = iir[binLut[i]]
  }

  // ⑨ Spatial filtering: bidirectional two-pass IIR, KFilter = 0.1 + 0.9×(10−F)/10
  const out = state.spatialFiltered
  if (params.spatialAveraging > 0) {
    const kf = 0.1 + (0.9 * (10 - params.spatialAveraging)) / 10
    let acc = resampled[0]
    for (let i = 0; i < n; i++) {
      acc += (resampled[i] - acc) * kf
      out[i] = acc / 2
    }
    acc = resampled[n - 1]
    for (let i = n - 1; i >= 0; i--) {
      acc += (resampled[i] - acc) * kf
      out[i] += acc / 2
    }
  } else {
    out.set(resampled)
  }

  // ⑩ Background: v = max(0, v − bg), written back into spatialFiltered (AddBackground)
  if (params.backgroundEnabled && state.background) {
    const bg = state.background
    for (let i = 0; i < n; i++) out[i] = Math.max(0, out[i] - bg[i])
  }

  // ⑪ Reference: MaxRef = maximum within the visible window (floor 0.1), full-length v × MaxRef/ref written back (AddReference)
  // After write-back, spatialFiltered is the data source for saving, consistent with the original program (§8.8)
  if (params.referenceEnabled && state.reference) {
    const ref = state.reference
    const x0 = Math.max(0, Math.min(n - 1, Math.floor((n * (params.startX ?? 0)) / 1000)))
    const len = Math.min(Math.max(1, n - x0 + Math.floor((n * ((params.endX ?? 1000) - 1000)) / 1000)), n - x0)
    let maxRef = 0.1
    for (let i = 0; i < len; i++) {
      const v = out[x0 + i]
      if (v > maxRef) maxRef = v
    }
    for (let i = 0; i < n; i++) {
      let v = out[i] * maxRef
      if (ref[i] > 0) v /= ref[i]
      out[i] = v
    }
  }
}

// Reference snapshot: values <200 → 99999 (discard weak-signal regions)
export function snapshotReference(state: PipelineState): void {
  const ref = new Float64Array(state.numSamples)
  for (let i = 0; i < state.numSamples; i++) {
    const v = state.spatialFiltered[i]
    ref[i] = v < 200 ? 99999 : v
  }
  state.reference = ref
}

export function snapshotBackground(state: PipelineState): void {
  state.background = new Float64Array(state.spatialFiltered)
}

export function resetSpectrumData(state: PipelineState): void {
  state.averaged.fill(0)
  state.averageCounter = 0
  state.iir.fill(0)
  state.resampled.fill(0)
  state.spatialFiltered.fill(0)
}

// Visible window extraction (⑫): returns the [SrcX0, SrcX0+SrcDX) range, maximum value and its index
export interface VisibleWindow {
  start: number
  length: number
  values: Float64Array
  maxPeakValue: number
  maxPeakIndex: number // Index into the full-length array
  maxVisibleValue: number
}

export function extractVisible(
  state: PipelineState,
  startX: number, // 0~1000 per-mille
  endX: number,
): VisibleWindow {
  const n = state.numSamples
  const x0 = Math.max(0, Math.min(n - 1, Math.floor((n * startX) / 1000)))
  const dx = Math.max(1, n - x0 + Math.floor((n * (endX - 1000)) / 1000))
  const len = Math.min(dx, n - x0)

  // Reference/Background were already written back into spatialFiltered in processFrame; here we only extract (reusing the scratch buffer)
  const src = state.spatialFiltered
  if (state.visibleScratch.length < len) state.visibleScratch = new Float64Array(len)
  const values = state.visibleScratch.subarray(0, len)
  for (let i = 0; i < len; i++) values[i] = src[x0 + i]

  let maxV = 0
  let maxI = 0
  for (let i = 0; i < len; i++) {
    if (values[i] > maxV) {
      maxV = values[i]
      maxI = i
    }
  }
  return {
    start: x0,
    length: len,
    values,
    maxPeakValue: maxV,
    maxPeakIndex: x0 + maxI,
    maxVisibleValue: Math.max(maxV, 1000),
  }
}

// Peak area (§9): trapezoidal integration of visible samples (base = nm difference between adjacent points, height = mean value)
export function peakArea(win: VisibleWindow, nmMin: number, nmMax: number, numSamples: number): number {
  const nmPerBin = (nmMax - nmMin) / numSamples
  let area = 0
  for (let i = 1; i < win.length; i++) {
    area += ((win.values[i] + win.values[i - 1]) / 2) * nmPerBin
  }
  return area
}

// SmoothValue_Pow_Adaptive (Module_Utils.vb): adaptive smoothing based on the squared change
export function smoothValuePowAdaptive(value: number, newValue: number, speed: number): number {
  const delta = newValue - value
  const deltaAbs = Math.abs(delta)
  let deltaPow = deltaAbs * deltaAbs * speed
  if (value !== 0) deltaPow /= Math.abs(value)
  let out: number
  if (deltaPow >= deltaAbs) out = newValue
  else out = value + Math.sign(delta) * deltaPow
  return Number.isNaN(out) ? 0 : out
}

// Globally smoothed PeakArea (matching the module-level PeakArea in Module_Spectrometer.vb, speed=1)
let smoothedPeakArea = 0

export function updatePeakArea(win: VisibleWindow, nmMin: number, nmMax: number, numSamples: number): number {
  smoothedPeakArea = smoothValuePowAdaptive(smoothedPeakArea, peakArea(win, nmMin, nmMax, numSamples), 1)
  return smoothedPeakArea
}

export function getPeakArea(): number {
  return smoothedPeakArea
}
