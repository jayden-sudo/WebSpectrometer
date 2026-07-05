// Peak/dip detection, ported from MarkAllPeaks in Module_Spectrometer.vb (§8.5)

export interface PeakInfo {
  index: number // Index into the visible samples array
  value: number
  isDip: boolean
}

// delta = max(2, number of samples corresponding to 20 display pixels)
export function detectPeaks(
  v: Float64Array | number[],
  maxVisibleValue: number,
  displayWidthPx: number,
  findPeaks: boolean,
  findDips: boolean,
): PeakInfo[] {
  const n = v.length
  const out: PeakInfo[] = []
  if (n < 5 || displayWidthPx <= 0) return out
  // VB uses truncating integer division (20*SrcDX)\DestW; must not use round (an off-by-1 changes the label set)
  const delta = Math.max(2, Math.trunc((20 * n) / displayWidthPx))

  for (let i = delta; i < n - delta; i++) {
    const vi = v[i]
    if (findPeaks && vi >= v[i + 1] && vi > v[i - 1] && vi * 100 > maxVisibleValue) {
      let ok = true
      for (let d = 2; d <= delta; d++) {
        if (vi < v[i + d] || vi < v[i - d]) {
          ok = false
          break
        }
      }
      if (ok) out.push({ index: i, value: vi, isDip: false })
    }
    if (findDips && vi < v[i + 1] && vi < v[i - 1] && vi * 1e7 > maxVisibleValue) {
      let ok = true
      for (let d = 2; d <= delta; d++) {
        if (vi > v[i + d] || vi > v[i - d]) {
          ok = false
          break
        }
      }
      if (ok) out.push({ index: i, value: vi, isDip: true })
    }
  }
  return out
}
