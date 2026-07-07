// File I/O (§13), ported from Module_SaveLoad.vb / Module_IrradianceCoeffs.vb

import { getState, markCalibrated, setCalibration, setRuntime } from '../app/store'
import { loadDataIntoPipeline, pipeline, setIrradiance } from '../app/engine'
import { sensorMetaPairs } from '../app/sensorMeta'
import { parseCalibration, serializeCalibration } from './calibration'
import { type IrradianceCoeffs } from './pipeline'

// ---------- Common: download and file picking ----------

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  downloadBlob(filename, blob)
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    // Resolve null on cancel
    input.oncancel = () => resolve(null)
    input.click()
  })
}

// ---------- Filename incrementing (§13.4): <name>_001.<ext>, used indices remembered within the session ----------

const usedIndices = new Map<string, number>()

export function nextFilename(base: string, ext: string): string {
  const key = `${base}.${ext}`
  const next = (usedIndices.get(key) ?? 0) + 1
  usedIndices.set(key, next)
  return `${base}_${String(next).padStart(3, '0')}.${ext}`
}

// ---------- Spectrum data file output (§13.1 GetSpectrumText) ----------

export function getSpectrumText(): string {
  const st = getState()
  const s = st.settings
  const sep = s.SpectrumFileSeparator
  const n = pipeline.numSamples

  const lines: string[] = []
  lines.push(`Sensor;${s.SensorType}`) // First line always uses ;
  lines.push('-----------------------')
  // Single source for header fields (shared with the Info window, see app/sensorMeta.ts)
  for (const [k, v] of sensorMetaPairs()) lines.push(`${k}${sep}${v}`)
  lines.push('-----------------------')
  lines.push(`Nanometers${sep}Intensity`)
  lines.push('-----------------------')

  // Data lines: nm "0.00"; intensity "0.0" PadLeft(12) (no padding when TAB-separated); data source = full-length spatialFiltered
  // Step k = (max−min)/(N−1) (CreateDataStringFromArray)
  const data = pipeline.spatialFiltered
  const isTab = sep === '\t'
  const kStep = (pipeline.nmMax - pipeline.nmMin) / (n - 1)
  for (let i = 0; i < n; i++) {
    const nm = pipeline.nmMin + i * kStep
    const v = data[i].toFixed(1)
    lines.push(`${nm.toFixed(2)}${sep}${isTab ? v : v.padStart(12)}`)
  }
  return lines.join('\r\n') + '\r\n'
}

export function saveDataFile(): void {
  const s = getState().settings
  const ext = s.SpectrumFileType.toLowerCase()
  downloadText(nextFilename(s.FileName, ext), getSpectrumText())
}

// ---------- Load data file (§13.1 Spectrometer_SetSpectrumTextFromFile) ----------

export async function loadDataFile(): Promise<void> {
  const f = await pickFile('.txt,.csv')
  if (!f) return
  await loadDataText(await f.text(), f.name)
}

// Info-window whitelist (Spectrometer_SetSpectrumTextFromFile): only these header keys are
// shown; everything else (Peak Area, AdcMax/Min, Nanometers;Intensity, …) is deliberately hidden
const WEBCAM_INFO_KEYS: Record<string, string> = {
  'rec.samples': 'Rec.Samples',
  framespersec: 'FramesPerSec',
  exposure: 'Exposure',
  gain: 'Gain',
  brightness: 'Brightness',
  contrast: 'Contrast',
  gamma: 'Gamma',
  average: 'Average',
  'spatial avg.': 'Spatial avg.',
}
const TCD_INFO_KEYS: Record<string, string> = {
  samples: 'Samples',
  adcspeed: 'AdcSpeed',
  exposure: 'Exposure',
  average: 'Average',
  'spatial avg.': 'Spatial avg.',
  receivedsamples: 'Rec.Samples',
  framespersec: 'FramesPerSec',
}
const COMMON_INFO_KEYS: Record<string, string> = {
  risingspeed: 'RisingSpeed',
  fallingspeed: 'FallingSpeed',
  nanometersmax: 'NanometersMax',
  nanometersmin: 'NanometersMin',
}

export async function loadDataText(text: string, filename: string): Promise<void> {
  const nms: number[] = []
  const values: number[] = []
  const meta: string[] = []
  let sensorName = ''
  for (const raw of text.split(/\r?\n/)) {
    // Replace TAB and , with ; first, then collapse repeated whitespace (order must not be reversed, otherwise \s+ would consume the TABs first)
    const line = raw.trim().replace(/[\t,]/g, ';').replace(/\s+/g, ' ')
    if (!line || /^-+$/.test(line)) continue
    const parts = line.split(';').map((s) => s.trim()).filter((s) => s !== '')
    if (parts.length === 2) {
      const a = Number.parseFloat(parts[0])
      if (Number.isFinite(a) && a > 0 && Number.isFinite(Number.parseFloat(parts[1]))) {
        nms.push(a)
        values.push(Number.parseFloat(parts[1]))
      } else {
        const key = parts[0].toLowerCase()
        if (key === 'sensor') {
          sensorName = parts[1]
          meta.push(`${'Sensor'.padEnd(15)}${parts[1]}`)
        } else {
          const table = sensorName.toLowerCase() === 'webcam' ? WEBCAM_INFO_KEYS : TCD_INFO_KEYS
          const label = table[key] ?? COMMON_INFO_KEYS[key]
          if (label) meta.push(`${label.padEnd(15)}${parts[1]}`)
        }
      }
    }
  }
  if (values.length < 2) return
  loadDataIntoPipeline(nms, values)
  // LastSpectrum files do not show metadata (§10 step 3)
  const isLast = filename.startsWith('LastSpectrum')
  setRuntime({ fileMode: filename, fileMeta: isLast ? [] : meta })
  if (!isLast) document.title = `Spectrometer - ${filename}`
}

// ---------- Calibration file (§12.3) ----------

export async function loadCalibrationFile(): Promise<void> {
  const f = await pickFile('.txt')
  if (!f) return
  const st = getState()
  const c = parseCalibration(await f.text(), st.runtime.numSamples)
  if (c) {
    setCalibration(c, st.runtime.numSamples)
    markCalibrated() // Loading a calibration file counts as being calibrated
  }
}

export function saveCalibrationAs(): void {
  const st = getState()
  downloadText('Calibration.txt', serializeCalibration(st.calibration, st.calibrationSamples))
}

// ---------- Irradiance coefficients (§13.3) ----------

export async function loadIrradianceFile(): Promise<void> {
  const f = await pickFile('.txt')
  if (!f) return
  const result = parseIrradiance(await f.text())
  if (typeof result === 'string') {
    alert(result)
    setIrradiance(null)
  } else {
    setIrradiance(result)
  }
}

export function parseIrradiance(text: string): IrradianceCoeffs | string {
  const nms: number[] = []
  const coeffs: number[] = []
  for (const raw of text.split(/\r?\n/)) {
    const parts = raw.trim().split(/[\s\t]+/)
    if (parts.length < 2) continue
    const nm = Number.parseFloat(parts[0])
    const c = Number.parseFloat(parts[1])
    // Validity condition: 10 < nm < 10000 and coeff > 0
    if (!Number.isFinite(nm) || !Number.isFinite(c) || nm <= 10 || nm >= 10000 || c <= 0) continue
    // nm must be strictly increasing, otherwise the whole file is invalid
    if (nms.length > 0 && nm <= nms[nms.length - 1]) {
      return 'Irradiance coefficients: nanometers must be strictly increasing'
    }
    nms.push(nm)
    coeffs.push(c)
  }
  if (nms.length < 2) return 'Irradiance coefficients: at least 2 valid lines required'
  return { nms, coeffs }
}

// ---------- Image saving (§5) ----------

export function saveCanvasImage(canvas: HTMLCanvasElement): void {
  const s = getState().settings
  const fmt = s.FileFormat === 'PNG' ? 'png' : 'jpg'
  const mime = fmt === 'png' ? 'image/png' : 'image/jpeg'
  canvas.toBlob(
    (blob) => {
      if (blob) downloadBlob(nextFilename(s.FileName, fmt), blob)
    },
    mime,
    1.0, // JPG quality 100
  )
}

// ---------- Save total (§5): entire app view → image ----------
// SVG foreignObject approach: clone the DOM, inline computed styles, convert canvas to <img>

function inlineStyles(src: Element, dst: Element): void {
  if (dst instanceof HTMLElement || dst instanceof SVGElement) {
    const cs = getComputedStyle(src)
    let cssText = ''
    for (let i = 0; i < cs.length; i++) {
      const p = cs[i]
      cssText += `${p}:${cs.getPropertyValue(p)};`
    }
    dst.setAttribute('style', cssText)
  }
  for (let i = 0; i < src.children.length; i++) {
    if (dst.children[i]) inlineStyles(src.children[i], dst.children[i])
  }
}

export async function saveTotalImage(): Promise<void> {
  const root = document.querySelector('.app')
  if (!root) return
  const W = root.clientWidth
  const H = root.clientHeight

  const clone = root.cloneNode(true) as HTMLElement
  inlineStyles(root, clone)

  // Canvas content is not serialized → replace with same-size <img>
  const srcCanvases = root.querySelectorAll('canvas')
  const dstCanvases = clone.querySelectorAll('canvas')
  dstCanvases.forEach((dc, i) => {
    const sc = srcCanvases[i]
    const img = document.createElement('img')
    try {
      img.src = sc.toDataURL()
    } catch {
      // Skip tainted canvas
    }
    img.setAttribute('style', dc.getAttribute('style') ?? '')
    dc.replaceWith(img)
  })
  // <input> values are not preserved by serialization → write back as attributes
  const srcInputs = root.querySelectorAll('input, select, textarea')
  const dstInputs = clone.querySelectorAll('input, select, textarea')
  dstInputs.forEach((di, i) => {
    const si = srcInputs[i]
    if (si instanceof HTMLInputElement && di instanceof HTMLInputElement) {
      di.setAttribute('value', si.value)
      if (si.checked) di.setAttribute('checked', '')
    }
  })

  const xhtml = new XMLSerializer().serializeToString(clone)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('svg render failed'))
    img.src = svgUrl
  })
  const canvas = document.createElement('canvas')
  const dpr = window.devicePixelRatio || 1
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.fillStyle = 'rgb(240,240,240)'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(img, 0, 0, W, H)
  saveCanvasImage(canvas)
}
