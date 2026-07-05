// Vertical-axis value range and Log transform (§8.3), matching the coordinate formulas in ShowSpectrumGraph

// LogScale parameter k (integer −10~+10) → internal exponent E
export function logExponent(k: number): number {
  if (k >= 0) return 1 / (1 + k / 5)
  return Math.pow(1.6, -k)
}

// Value→Y: destH = drawing area height; 15px tick band reserved at the top; h = destH − 15
export function valueToY(v: number, maxVisibleValue: number, destH: number, k: number): number {
  const h = destH - 15
  const p = (v * 100) / maxVisibleValue
  let y = h - (p * h) / 100 + 15
  const e = logExponent(k)
  if (e !== 1) {
    y = destH - Math.pow((destH - y) / h, e) * h
  }
  return y
}

// Y→value (cursor readout), inverse of the above (power 1/E)
export function yToValue(y: number, maxVisibleValue: number, destH: number, k: number): number {
  const h = destH - 15
  const e = logExponent(k)
  let yy = y
  if (e !== 1) {
    yy = destH - Math.pow((destH - y) / h, 1 / e) * h
  }
  const p = ((h - (yy - 15)) * 100) / h
  return (p * maxVisibleValue) / 100
}
