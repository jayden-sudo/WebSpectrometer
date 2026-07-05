// Calibration system, ported from Module_Calibrations.vb (§12)
// Two parallel arrays BIN[] (sample indices) and NM[] (wavelengths); piecewise linear interpolation + endpoint-slope extrapolation

export interface Calibration {
  bins: number[]
  nms: number[]
}

export const DEFAULT_CALIBRATION: Calibration = {
  // Based on 3600 samples; on WebCam connect, scaled proportionally by newWidth/oldN
  bins: [1000, 2000],
  nms: [436, 546],
}

export const DEFAULT_NUM_SAMPLES = 3600

// Single Interpolate: xs strictly increasing; extrapolate using first/last segment slope (shared by calibration and irradiance coefficients)
export function interpolate(xs: number[], ys: number[], x: number): number {
  const n = xs.length
  if (n === 1) return ys[0]
  let i = 0
  // Find segment [i, i+1]; when x is out of range, extrapolate using first/last segment
  if (x <= xs[0]) i = 0
  else if (x >= xs[n - 1]) i = n - 2
  else {
    while (i < n - 2 && x > xs[i + 1]) i++
  }
  const x0 = xs[i]
  const x1 = xs[i + 1]
  const y0 = ys[i]
  const y1 = ys[i + 1]
  if (x1 === x0) return y0
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0)
}

export function binToNm(c: Calibration, bin: number): number {
  return interpolate(c.bins, c.nms, bin)
}

export function nmToBin(c: Calibration, nm: number): number {
  return interpolate(c.nms, c.bins, nm)
}

// nm display clamp: Min = max(BinToNm(0), 0); Max = min(BinToNm(N), 4000); Max ≥ Min+10
export function nmRange(c: Calibration, numSamples: number): { nmMin: number; nmMax: number } {
  const nmMin = Math.max(binToNm(c, 0), 0)
  let nmMax = Math.min(binToNm(c, numSamples), 4000)
  if (nmMax < nmMin + 10) nmMax = nmMin + 10
  return { nmMin, nmMax }
}

// Proportionally rescale BIN when WebCam connects / sample count changes
export function rescaleCalibration(c: Calibration, oldN: number, newN: number): Calibration {
  if (oldN === newN || oldN <= 0) return c
  const k = newN / oldN
  return { bins: c.bins.map((b) => b * k), nms: [...c.nms] }
}

// Add calibration point: insert sorted by bin
export function addPoint(c: Calibration, bin: number, nm: number): Calibration {
  const bins = [...c.bins]
  const nms = [...c.nms]
  let i = 0
  while (i < bins.length && bins[i] < bin) i++
  bins.splice(i, 0, bin)
  nms.splice(i, 0, nm)
  return { bins, nms }
}

// Remove calibration point: refuse when only 2 points remain (return null)
export function removePoint(c: Calibration, index: number): Calibration | null {
  if (c.bins.length <= 2) return null
  const bins = [...c.bins]
  const nms = [...c.nms]
  bins.splice(index, 1)
  nms.splice(index, 1)
  return { bins, nms }
}

// Edit clamp: BIN kept within ±1 of adjacent points; range [0, N]
export function clampBin(c: Calibration, index: number, bin: number, numSamples: number): number {
  const lo = index > 0 ? c.bins[index - 1] + 1 : 0
  const hi = index < c.bins.length - 1 ? c.bins[index + 1] - 1 : numSamples
  return Math.min(Math.max(bin, lo), hi)
}

// Edit clamp: NM kept within ±0.25nm of adjacent points; upper bound 2000
export function clampNm(c: Calibration, index: number, nm: number): number {
  const lo = index > 0 ? c.nms[index - 1] + 0.25 : 0
  const hi = index < c.nms.length - 1 ? c.nms[index + 1] - 0.25 : 2000
  return Math.min(Math.max(nm, lo), hi)
}

// Calibration file serialization (§12.3): exactly two lines, BIN normalized to 0~1, | separated
// Prefix = name + "=" + space-padded to 23 columns total, no trailing CRLF (byte-level identical to Module_SaveLoad.vb 110/648)
export function serializeCalibration(c: Calibration, numSamples: number): string {
  const inv = (v: number) => String(v)
  const pad = (name: string) => (name + '=').padEnd(23, ' ')
  const bins = c.bins.map((b) => inv(b / numSamples)).join('|')
  const nms = c.nms.map((n) => inv(n)).join('|')
  return `${pad('CalibrationBins')}${bins}\r\n${pad('CalibrationNanometers')}${nms}`
}

// Load: if any line has fewer than 2 values, ignore the whole file (return null); restore BIN × current sample count
export function parseCalibration(text: string, numSamples: number): Calibration | null {
  let bins: number[] | null = null
  let nms: number[] | null = null
  for (const raw of text.split(/\r?\n/)) {
    const eq = raw.indexOf('=')
    if (eq < 0) continue
    const key = raw.slice(0, eq).trim()
    const vals = raw
      .slice(eq + 1)
      .trim()
      .split('|')
      .map((s) => Number.parseFloat(s))
      .filter((v) => Number.isFinite(v))
    if (key === 'CalibrationBins') bins = vals.map((v) => v * numSamples)
    else if (key === 'CalibrationNanometers') nms = vals
  }
  if (!bins || !nms || bins.length < 2 || nms.length < 2 || bins.length !== nms.length) return null
  return { bins, nms }
}
