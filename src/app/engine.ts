// Engine: wires CameraCapture → pipeline (§11) → render notification
// Independent of React; components get per-frame updates via subscribeFrame

import { CameraCapture, type FrameResult } from '../camera/capture'
import {
  AutoExposure,
  TcdSerial,
  TCD_EXPOSURE_OPTIONS,
  TCD_RESOLUTION_OPTIONS,
  TCD_ADC_SPEED_OPTIONS,
  TCD_SCALE_OPTIONS,
  type TcdFrame,
} from '../serial/tcd'
import {
  createPipelineState,
  processFrame,
  runDisplayStages,
  snapshotBackground,
  snapshotReference,
  resetSpectrumData,
  type IrradianceCoeffs,
  type PipelineState,
} from '../core/pipeline'
import { rescaleCalibration } from '../core/calibration'
import { AVERAGE_OPTIONS } from '../core/settings'
import { getState, hasCalibrated, markCalibrated, setCalibration, setRuntime, setSettings } from './store'

export const camera = new CameraCapture()
export const tcd = new TcdSerial()
const autoExposure = new AutoExposure()

// Latest raw TCD ADC samples of the last frame (for oscilloscope preview)
export let lastTcdFrame: TcdFrame | null = null

export let pipeline: PipelineState = createPipelineState(1920)

export let irradiance: IrradianceCoeffs | null = null

export function setIrradiance(c: IrradianceCoeffs | null): void {
  irradiance = c
}

let lastRoi: FrameResult | null = null

export function getLastRoi(): FrameResult | null {
  return lastRoi
}

type FrameListener = () => void
const frameListeners = new Set<FrameListener>()

export function subscribeFrame(cb: FrameListener): () => void {
  frameListeners.add(cb)
  return () => frameListeners.delete(cb)
}

export type EngineEvent = 'averageDone'
const eventListeners = new Set<(e: EngineEvent) => void>()

export function subscribeEngineEvent(cb: (e: EngineEvent) => void): () => void {
  eventListeners.add(cb)
  return () => eventListeners.delete(cb)
}

let fpsUpdateCounter = 0

camera.onFps = (fps) => {
  // Update the store every 15 frames to avoid high-frequency re-renders
  if (++fpsUpdateCounter % 15 === 0) {
    setRuntime({ fps: Math.round(fps * 10) / 10 })
  }
}

camera.onFrame = (frame) => {
  const { settings } = getState()
  lastRoi = frame

  // Calibration rescale must key off calibrationSamples, NOT pipeline size:
  // after a reload the stored calibration is re-materialized on a 3600-sample
  // basis while the pipeline may already match the camera width, so tying the
  // rescale to the pipeline rebuild silently skipped it (calibration lost on refresh)
  {
    const st = getState()
    if (st.calibrationSamples !== frame.width) {
      setCalibration(rescaleCalibration(st.calibration, st.calibrationSamples, frame.width), frame.width)
    }
  }
  // Sample count = camera width; on change, rebuild the pipeline
  if (pipeline.numSamples !== frame.width) {
    pipeline = createPipelineState(frame.width)
    setRuntime({ numSamples: frame.width })
  }

  const params = {
    averageEnabled: settings.AverageEnabled,
    averageCount: AVERAGE_OPTIONS[settings.Average] ?? 1,
    spatialAveraging: settings.SpatialAveraging,
    risingSpeed: settings.RisingSpeed,
    fallingSpeed: settings.FallingSpeed,
    referenceEnabled: pipeline.reference !== null,
    backgroundEnabled: pipeline.background !== null,
    startX: settings.StartX,
    endX: settings.EndX,
  }

  processFrame(pipeline, frame.samples, params, getState().calibration, irradiance)

  if (pipeline.averageCounter !== getState().runtime.averageCounter) {
    setRuntime({ averageCounter: pipeline.averageCounter })
  }
  if (pipeline.averageDone) {
    for (const l of eventListeners) l('averageDone')
  }

  for (const l of frameListeners) l()
}

export async function connectCamera(): Promise<void> {
  const { settings } = getState()
  if (settings.SensorType !== 'WebCam') {
    await connectTcd()
    return
  }
  camera.roi = { startY: settings.StartY, sizeY: settings.SizeY, flipH: settings.FlipH }
  const [w, h] = settings.VideoSize.split('x').map((s) => Number.parseInt(s.trim(), 10))
  const devices = await navigator.mediaDevices.enumerateDevices()
  const videoDevs = devices.filter((d) => d.kind === 'videoinput')
  const idx = Number.parseInt(settings.VideoInDevice, 10)
  const dev = videoDevs[Number.isFinite(idx) ? idx : 0]
  const res = await camera.connect(dev?.deviceId, w || 1920, h || 1080, settings.VideoFPS)
  // OpenWebCam calls Spectrometer_ResetAllData + AverageStart: reconnecting at the same
  // resolution must start from cleared arrays, not decay the previous spectrum
  resetSpectrumData(pipeline)
  setRuntime({
    connected: true,
    resolution: `${res.width} x ${res.height}`,
    deviceLabel: dev?.label ?? '',
    fileMode: null,
  })
  // Persist Connected only after a successful connect (cancel/failure must not write it, otherwise auto-reconnect on next startup would always fail)
  setSettings({ Connected: true })
  // Uncalibrated reminder (new in web version): calibration is a prerequisite for a usable spectrum, checked after a successful connect
  if (!hasCalibrated()) setRuntime({ showCalibrationHint: true })
}

export async function disconnectCamera(): Promise<void> {
  await camera.disconnect()
  await tcd.disconnect()
  setRuntime({ connected: false, fps: 0 })
  setSettings({ Connected: false })
}

// Notify the render layer (operations like doReference must be reflected immediately even with no incoming frames)
export function notifyFrame(): void {
  for (const l of frameListeners) l()
}

// Trim preset points (Menu_Tools_Trim1/2_Click): reset two-point calibration, save (included in setCalibration),
// auto-enable Trim scale and redraw immediately; BINs scale proportionally against a 3600-sample baseline (NormalizeArrayTo)
export function applyTrimPreset(bin1: number, bin2: number, nm1: number, nm2: number): void {
  const n = pipeline.numSamples
  setCalibration({ bins: [(bin1 * n) / 3600, (bin2 * n) / 3600], nms: [nm1, nm2] }, n)
  markCalibrated()
  setSettings({ TrimScale: true })
  notifyFrame()
}

// ---------- TCD serial sensor ----------

export function syncTcdOptions(): void {
  const s = getState().settings
  tcd.options = {
    resolution: TCD_RESOLUTION_OPTIONS[s.Resolution] ?? 3600,
    adcSpeed: TCD_ADC_SPEED_OPTIONS[s.AdcSpeed] ?? 3,
    exposureLabel: TCD_EXPOSURE_OPTIONS[s.Exposure] ?? '10 min',
    isTcd1254: s.SensorType === 'TCD1254',
    flipH: s.FlipH,
    flipV: s.FlipV,
    adcScale: Math.pow(2, TCD_SCALE_OPTIONS[s.Scale] ?? 10),
  }
}

export async function connectTcd(): Promise<void> {
  syncTcdOptions()
  await tcd.connect()
  // OpenComm calls Spectrometer_ResetAllData + AverageStart (same as the webcam path)
  resetSpectrumData(pipeline)
  setRuntime({
    connected: true,
    resolution: String(tcd.options.resolution),
    deviceLabel: 'Serial',
    fileMode: null,
  })
  setSettings({ Connected: true })
}

let tcdFrameCount = 0
let tcdLastFpsTime = 0

tcd.onFrame = (frame) => {
  const st = getState()
  const s = st.settings
  lastTcdFrame = frame

  // FPS estimate
  tcdFrameCount++
  const now = performance.now()
  if (now - tcdLastFpsTime > 1000) {
    setRuntime({ fps: Math.round((tcdFrameCount * 10000) / (now - tcdLastFpsTime)) / 10 })
    tcdFrameCount = 0
    tcdLastFpsTime = now
  }

  const n = frame.samples.length
  // Same decoupling as camera.onFrame: rescale keyed off calibrationSamples
  if (st.calibrationSamples !== n) {
    setCalibration(rescaleCalibration(st.calibration, st.calibrationSamples, n), n)
  }
  if (pipeline.numSamples !== n) {
    pipeline = createPipelineState(n)
    setRuntime({ numSamples: n })
  }

  const adcScale = tcd.options.adcScale
  const scaleCoeff = Math.floor(65536 / adcScale)
  // AdcMin Auto only runs while Average is off (VB 556): the subtractor is the raw received
  // minimum (uncapped, VB 560); the cap only applies to the value written back into the
  // AdcMin box (VB 558). While averaging, the subtractor stays frozen at the box value.
  let adcMin = s.AdcMin
  if (s.AdcMinAuto && !s.AverageEnabled) {
    adcMin = frame.valueMin
    const boxValue = Math.min(Math.round(frame.valueMin), s.AdcMax - Math.floor(adcScale / 8))
    if (boxValue !== s.AdcMin) setSettings({ AdcMin: boxValue })
  }

  processFrame(
    pipeline,
    frame.samples,
    {
      averageEnabled: s.AverageEnabled,
      averageCount: AVERAGE_OPTIONS[s.Average] ?? 1,
      spatialAveraging: s.SpatialAveraging,
      risingSpeed: s.RisingSpeed,
      fallingSpeed: s.FallingSpeed,
      referenceEnabled: pipeline.reference !== null,
      backgroundEnabled: pipeline.background !== null,
      scaleCoeff,
      adcMinScaled: adcMin * scaleCoeff,
      startX: s.StartX,
      endX: s.EndX,
    },
    st.calibration,
    irradiance,
  )

  // Auto exposure (hysteresis state machine); send OPTIONS on change
  if (s.AutoExposure) {
    const newIdx = autoExposure.step(s.Exposure, frame.valueMax, s.AdcMax)
    if (newIdx !== s.Exposure) {
      setSettings({ Exposure: newIdx })
      syncTcdOptions()
      void tcd.sendOptions()
    }
  }

  if (pipeline.averageCounter !== st.runtime.averageCounter) {
    setRuntime({ averageCounter: pipeline.averageCounter })
  }
  if (pipeline.averageDone) {
    for (const l of eventListeners) l('averageDone')
  }
  for (const l of frameListeners) l()
}

export function doReference(): void {
  if (pipeline.reference) pipeline.reference = null
  else snapshotReference(pipeline)
  setRuntime({ referenceOn: pipeline.reference !== null })
  notifyFrame()
}

export function doBackground(): void {
  if (pipeline.background) pipeline.background = null
  else snapshotBackground(pipeline)
  setRuntime({ backgroundOn: pipeline.background !== null })
  notifyFrame()
}

export function doResetSpectrum(): void {
  resetSpectrumData(pipeline)
  notifyFrame()
}

// Load data file (§4.1): disconnect the camera; file values land in `resampled`
// (= Array_Calibrated) and the display stages run over them — the original re-runs
// SpatialFilter/Background/Reference on every redraw of a loaded file, so the
// Spatial avg. control keeps working (and re-saves smoothed data) in file mode
export function loadDataIntoPipeline(nms: number[], values: number[]): void {
  void disconnectCamera()
  const n = values.length
  pipeline = createPipelineState(n)
  pipeline.resampled.set(values)
  pipeline.nmMin = nms[0] ?? 0
  // NmMax is the maximum over all lines, not the last line (Spectrometer_SetSpectrumTextFromFile),
  // so a non-ascending (hand-edited) file cannot produce a reversed axis
  let nmMax = 0
  for (const nm of nms) if (nm > nmMax) nmMax = nm
  pipeline.nmMax = nmMax || 1000
  pipeline.reference = null
  pipeline.background = null
  runFileDisplayStages()
  // Deliberately do NOT touch calibration state here: the file's nm axis lives
  // in pipeline.nmMin/nmMax only, matching the original program where loading a
  // data file never modifies the Calib arrays. Writing it via setCalibration
  // would clobber the user's persisted calibration in localStorage — the
  // LastSpectrum load at startup used to destroy the fluorescent-lamp
  // calibration exactly this way (calibration-lost-on-refresh bug).
  setRuntime({ numSamples: n, referenceOn: false, backgroundOn: false })
  notifyFrame()
}

function runFileDisplayStages(): void {
  const s = getState().settings
  runDisplayStages(pipeline, {
    spatialAveraging: s.SpatialAveraging,
    backgroundEnabled: pipeline.background !== null,
    referenceEnabled: pipeline.reference !== null,
    startX: s.StartX,
    endX: s.EndX,
  })
}

// Re-run the display stages over loaded file data. The spectrum view calls this before each
// draw while in file mode, mirroring Prepare_VisibleSamples running on every redraw.
export function reprocessFileData(): void {
  if (getState().runtime.fileMode === null) return
  runFileDisplayStages()
}
