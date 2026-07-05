// Wavelength→RGB, ported from WavelengthToColor in Module_Spectrometer.vb (§8.6)
// Segment nodes 380/440/490/510/580/645/780; fading: UV 380→420 rises to 1, IR 650→780 falls to 0 (not the standard 700)

export function wavelengthToColor(nm: number): [number, number, number] {
  let r = 0
  let g = 0
  let b = 0

  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / (440 - 380)
    g = 0
    b = 1
  } else if (nm >= 440 && nm < 490) {
    r = 0
    g = (nm - 440) / (490 - 440)
    b = 1
  } else if (nm >= 490 && nm < 510) {
    r = 0
    g = 1
    b = -(nm - 510) / (510 - 490)
  } else if (nm >= 510 && nm < 580) {
    r = (nm - 510) / (580 - 510)
    g = 1
    b = 0
  } else if (nm >= 580 && nm < 645) {
    r = 1
    g = -(nm - 645) / (645 - 580)
    b = 0
  } else if (nm >= 645 && nm <= 780) {
    r = 1
    g = 0
    b = 0
  }

  let factor = 0
  if (nm >= 380 && nm < 420) {
    factor = (nm - 380) / (420 - 380)
  } else if (nm >= 420 && nm < 650) {
    factor = 1
  } else if (nm >= 650 && nm <= 780) {
    factor = 1 - (nm - 650) / (780 - 650)
  }

  return [
    Math.round(255 * r * factor),
    Math.round(255 * g * factor),
    Math.round(255 * b * factor),
  ]
}

const cache = new Map<number, string>()

// Cache CSS color strings quantized to 0.1nm units (for the drawing hot path)
export function wavelengthToCss(nm: number): string {
  const key = Math.round(nm * 10)
  let css = cache.get(key)
  if (css === undefined) {
    const [r, g, b] = wavelengthToColor(key / 10)
    css = `rgb(${r},${g},${b})`
    cache.set(key, css)
  }
  return css
}
