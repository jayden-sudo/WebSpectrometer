// Spectrum display area (§8): adaptive grid, colored curve, Log transform, peak/dip labels, zoom/pan
// + calibration Trim interaction (§12.2) + hidden peak-label clipboard feature (§8.7)
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { getState, markCalibrated, setCalibration, setRuntime, setSettings, useAppState } from '../app/store'
import { useT } from '../i18n'
import { pipeline, subscribeFrame } from '../app/engine'
import { extractVisible, updatePeakArea } from '../core/pipeline'
import { valueToY, yToValue } from '../core/logScale'
import { detectPeaks } from '../core/peaks'
import { wavelengthToCss } from '../core/wavelengthColor'
import { addPoint, clampBin, clampNm, nmToBin, removePoint } from '../core/calibration'

interface LabelRect {
  x: number
  y: number
  w: number
  h: number
}

interface PeakLabelHit extends LabelRect {
  nm: number
  value: number
}

interface TrimLabelHit {
  cx: number // label center x (hit test |mx-cx| < 20, matching the original source)
  index: number
}

// ShowTrimmingData: TRIM: <nm> nm <±nonlinearity%>; error computed only with >2 points, baseline = interpolation of the two adjacent points, edge points get inverted sign
function showTrimmingData(calib: { bins: number[]; nms: number[] }, i: number): string {
  const nm1 = calib.nms[i]
  let s = `TRIM:  ${nm1.toFixed(2)} nm   `
  if (calib.nms.length > 2) {
    let idx = i
    let invert = false
    if (idx === 0) {
      idx = 1
      invert = true
    }
    if (idx === calib.nms.length - 1) {
      idx = calib.nms.length - 2
      invert = true
    }
    const k = (calib.nms[idx] - calib.nms[idx - 1]) / (calib.nms[idx + 1] - calib.nms[idx - 1])
    const bin2 = calib.bins[idx - 1] + (calib.bins[idx + 1] - calib.bins[idx - 1]) * k
    let pct = (100 * calib.bins[idx]) / bin2 - 100
    if (invert) pct = -pct
    s += `${pct >= 0 ? '+' : '-'}${Math.abs(pct).toFixed(2)}%`
  }
  return s
}

export interface SpectrumMeasure {
  mode: 'value' | 'max'
  value: number
  nm: number
  peakArea: number
}

interface Props {
  onMeasure: (m: SpectrumMeasure) => void
}

const DEST_LEFT = 37 // vertical-axis scale text area
const TOP_BAND = 15 // horizontal-axis scale numbers + calibration label band

export const SpectrumView = forwardRef<HTMLCanvasElement | null, Props>(function SpectrumView({ onMeasure }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement)
  const { settings } = useAppState()
  const mouseRef = useRef<{ x: number; y: number; inside: boolean }>({ x: 0, y: 0, inside: false })
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  // Add/delete confirmation messages use the current language (handlers are bound once, latest is read via ref)
  const t = useT()
  const tRef = useRef(t)
  tRef.current = t

  // Hit-test data (filled in during draw)
  const peakLabelsRef = useRef<PeakLabelHit[]>([])
  const trimLabelsRef = useRef<TrimLabelHit[]>([])
  const viewRef = useRef<{ nmStart: number; nmCoeff: number } | null>(null)
  // Clipboard FIFO (§8.7): max 7 lines, dedupe adjacent duplicates; cleared when a new file is loaded
  const clipFifoRef = useRef<string[]>([])
  // Colors rainbow layer cache: key = nm window + width; rebuilt only on change (avoids ~1900 strokes per frame)
  const rainbowRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null)
  const [clipBox, setClipBox] = useState<{ x: number; y: number } | null>(null)
  // Calibration point drag state (matching the original source: record initial values at mouse-down, incremental editing)
  const trimDragRef = useRef<{
    index: number
    startX: number
    initialBin: number
    initialNm: number
    modified: boolean
  } | null>(null)

  // Redraw every frame: subscription is created only once (draw reads the latest settings via settingsRef; the subscription is not torn down/rebuilt while dragging)
  const redrawRef = useRef<() => void>(() => {})
  useEffect(() => {
    let raf = 0
    const redraw = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(draw)
    }
    redrawRef.current = redraw
    const unsub = subscribeFrame(redraw)
    const obs = new ResizeObserver(redraw)
    if (canvasRef.current?.parentElement) obs.observe(canvasRef.current.parentElement)
    redraw()
    return () => {
      unsub()
      obs.disconnect()
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Settings changes (toggling Colors/LogScale, zooming, etc.) must redraw immediately even when no frames are flowing in
  useEffect(() => {
    redrawRef.current()
  }, [settings])

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const W = parent.clientWidth
    const H = parent.clientHeight
    if (W < 50 || H < 50) return
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr
      canvas.height = H * dpr
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const s = settingsRef.current
    const st = getState()

    // Canvas background AliceBlue
    ctx.fillStyle = 'rgb(240,248,255)'
    ctx.fillRect(0, 0, W, H)

    const win = extractVisible(pipeline, s.StartX, s.EndX)

    const destW = W - DEST_LEFT
    const destH = H
    const n = pipeline.numSamples
    const nmMin = pipeline.nmMin
    const nmMax = pipeline.nmMax
    const nmAt = (idx: number) => nmMin + ((nmMax - nmMin) * idx) / n
    const nmStart = nmAt(win.start)
    const nmEnd = nmAt(win.start + win.length)
    const nmCoeff = destW / Math.max(nmEnd - nmStart, 0.001) // pixels per nm
    const nmToX = (nm: number) => DEST_LEFT + (nm - nmStart) * nmCoeff
    const maxV = win.maxVisibleValue
    const vToY = (v: number) => valueToY(v, maxV, destH, s.LogScale)

    drawGrid(ctx, W, H, nmStart, nmEnd, nmCoeff, nmToX, maxV, destH, s.LogScale)

    // Curve and coloring (§8.4)
    const idxToX = (i: number) => nmToX(nmAt(win.start + i))
    if (s.Colors && win.length > 1) {
      // The rainbow layer is rebuilt only when the nm window/width changes; just one clip + drawImage per frame
      const rbKey = `${nmStart.toFixed(3)}|${nmEnd.toFixed(3)}|${Math.round(destW)}`
      let rb = rainbowRef.current
      if (!rb || rb.key !== rbKey) {
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(destW))
        c.height = 1
        const rctx = c.getContext('2d')
        if (rctx) {
          for (let px = 0; px < c.width; px++) {
            const nm = nmStart + px / nmCoeff
            rctx.fillStyle = wavelengthToCss(nm)
            rctx.fillRect(px, 0, 1, 1)
          }
        }
        rb = { key: rbKey, canvas: c }
        rainbowRef.current = rb
      }
      // Use the area under the curve as the clipping path
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(idxToX(0), destH)
      for (let i = 0; i < win.length; i++) {
        ctx.lineTo(idxToX(i), vToY(win.values[i]))
      }
      ctx.lineTo(idxToX(win.length - 1), destH)
      ctx.closePath()
      ctx.clip()
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(rb.canvas, DEST_LEFT, 0, destW, destH)
      ctx.restore()
    }

    // Dark green polyline RGB(0,70,0)
    ctx.strokeStyle = 'rgb(0,70,0)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < win.length; i++) {
      const x = idxToX(i)
      const y = vToY(win.values[i])
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // If adjacent data points are >2px apart: draw a small 3x3 box at each point
    if (destW / win.length > 2) {
      ctx.fillStyle = 'rgb(0,70,0)'
      for (let i = 0; i < win.length; i++) {
        ctx.fillRect(idxToX(i) - 1.5, vToY(win.values[i]) - 1.5, 3, 3)
      }
    }

    // Peak/dip labels (§8.5)
    viewRef.current = { nmStart, nmCoeff }
    peakLabelsRef.current = []
    if (s.Peaks || s.Dips) {
      const peaks = detectPeaks(win.values, maxV, destW, s.Peaks, s.Dips)
      ctx.font = '12px Arial'
      for (const p of peaks) {
        const nm = nmAt(win.start + p.index)
        const x = idxToX(p.index)
        const y = vToY(p.value)
        const label = nmCoeff > 50 ? nm.toFixed(2) : String(Math.round(nm))
        const tw = ctx.measureText(label).width + 8
        if (!p.isDip) {
          // Red vertical line: from just below the peak to the bottom
          ctx.strokeStyle = 'red'
          ctx.beginPath()
          ctx.moveTo(x + 0.5, y + 4)
          ctx.lineTo(x + 0.5, destH)
          ctx.stroke()
          let ly = y - 20
          if (ly < TOP_BAND + 2) ly = destH - 20
          drawLabel(ctx, x - tw / 2, ly - 7, tw, 14, label, 'green')
          peakLabelsRef.current.push({ x: x - tw / 2, y: ly - 7, w: tw, h: 14, nm, value: p.value })
          if (nmCoeff > 50) {
            drawLabel(ctx, x - tw / 2, ly + 9, tw, 14, String(Math.round(p.value)), 'green')
          }
        } else {
          ctx.strokeStyle = 'green'
          ctx.beginPath()
          ctx.moveTo(x + 0.5, 40)
          ctx.lineTo(x + 0.5, y - 4)
          ctx.stroke()
          drawLabel(ctx, x - tw / 2, 30 - 7, tw, 14, label, 'green')
        }
      }
    }

    // Calibration labels (when Trim scale is on; see interaction handlers for dragging/add/delete)
    trimLabelsRef.current = []
    if (s.TrimScale) {
      ctx.font = '12px Arial'
      const calib = st.calibration
      for (let ci = 0; ci < calib.bins.length; ci++) {
        const nm = calib.nms[ci]
        if (nm < nmStart || nm > nmEnd) continue
        const x = nmToX(nm)
        // Solid black line + white dotted line overlaid (alternating dash pattern)
        ctx.strokeStyle = 'black'
        ctx.beginPath()
        ctx.moveTo(x + 0.5, TOP_BAND)
        ctx.lineTo(x + 0.5, destH)
        ctx.stroke()
        ctx.strokeStyle = 'white'
        ctx.setLineDash([2, 2])
        ctx.beginPath()
        ctx.moveTo(x + 0.5, TOP_BAND)
        ctx.lineTo(x + 0.5, destH)
        ctx.stroke()
        ctx.setLineDash([])
        const label = String(Math.round(nm))
        const tw = ctx.measureText(label).width + 8
        drawLabel(ctx, x - tw / 2, 1, tw, 14, label, 'red')
        trimLabelsRef.current.push({ cx: x, index: ci })
      }
    }

    // Measurement (§9): PeakArea smoothed via SmoothValue_Pow_Adaptive (speed=1)
    const pa = updatePeakArea(win, nmMin, nmMax, n)
    const m = mouseRef.current
    if (m.inside && m.x > DEST_LEFT) {
      const nm = nmStart + (m.x - DEST_LEFT) / nmCoeff
      onMeasure({ mode: 'value', value: yToValue(m.y, maxV, destH, s.LogScale), nm, peakArea: pa })
    } else {
      onMeasure({ mode: 'max', value: win.maxPeakValue, nm: nmAt(win.maxPeakIndex), peakArea: pa })
    }
  }

  // Wheel zoom / drag pan (§8.7)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = settingsRef.current
      const rect = canvas.getBoundingClientRect()
      const delta = (e.deltaY < 0 ? 1 : -1) * (e.ctrlKey ? 0.1 : 1)
      // dx = (delta*EndX - StartX)/2000 → about 6% of the window per notch
      const span = s.EndX - s.StartX
      const dx = (delta * span * 120) / 2000
      const k1 = Math.max(0, Math.min(1, (e.clientX - rect.left - DEST_LEFT) / (rect.width - DEST_LEFT)))
      let start = s.StartX + dx * k1
      let end = s.EndX - dx * (1 - k1)
      start = Math.max(0, Math.min(995, start))
      end = Math.max(start + 5, Math.min(1000, end))
      setSettings({ StartX: Math.round(start), EndX: Math.round(end) })
    }
    let drag: { x: number; startX: number; endX: number } | null = null

    const hitRect = (r: LabelRect, x: number, y: number, padX = 0, padY = 0) =>
      x >= r.x - padX && x <= r.x + r.w + padX && y >= r.y - padY && y <= r.y + r.h + padY

    // Hit test (PBox_Spectrum_MouseDown): top band y<15 and |x - label x| < 20
    const hitTrimPoint = (mx: number, my: number): TrimLabelHit | undefined => {
      if (my >= TOP_BAND) return undefined
      return trimLabelsRef.current.find((r) => Math.abs(mx - r.cx) < 20)
    }

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const s = settingsRef.current

      // Calibration label dragging (§12.2): with TrimScale on, TRIM data is shown as soon as the button is pressed
      if (s.TrimScale) {
        const hit = hitTrimPoint(mx, my)
        if (hit) {
          const c = getState().calibration
          trimDragRef.current = {
            index: hit.index,
            startX: mx,
            initialBin: c.bins[hit.index],
            initialNm: c.nms[hit.index],
            modified: false,
          }
          setRuntime({ trimInfo: showTrimmingData(c, hit.index) })
          e.preventDefault()
          return
        }
      }

      // Click near a peak label (±20px, ±30px) → clipboard FIFO (§8.7)
      const peak = peakLabelsRef.current.find((r) => hitRect(r, mx, my, 20, 30))
      if (peak) {
        const line = `${String(Math.round(peak.value)).padStart(5, '0')}  ${peak.nm.toFixed(2)} nm`
        const fifo = clipFifoRef.current
        if (fifo[fifo.length - 1] !== line) {
          fifo.push(line)
          while (fifo.length > 7) fifo.shift()
        }
        void navigator.clipboard?.writeText(fifo.join('\n')).catch(() => undefined)
        setClipBox({ x: mx + 12, y: my - 30 })
        return
      }

      drag = { x: e.clientX, startX: s.StartX, endX: s.EndX }
    }

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      mouseRef.current = { x: mx, y: my, inside: true }

      // Calibration point being dragged (PBox_Spectrum_MouseMove): incremental, zoom scales with visible window width
      const td = trimDragRef.current
      if (td) {
        const c = getState().calibration
        const s = settingsRef.current
        const dx = mx - td.startX
        const zoom = (0.001 * (s.EndX - s.StartX)) / window.innerWidth
        let newCalib = c
        if (e.ctrlKey) {
          // CTRL+drag: edit NM (increment dx*zoom*100, clamped to ±0.25 of neighboring points)
          const nm = clampNm(c, td.index, td.initialNm + dx * zoom * 100)
          const nms = [...c.nms]
          nms[td.index] = nm
          newCalib = { bins: c.bins, nms }
        } else {
          // Drag: edit BIN (increment dx*zoom*2000, clamped to ±1 of neighboring points)
          const bin = clampBin(c, td.index, td.initialBin + dx * zoom * 2000, pipeline.numSamples)
          const bins = [...c.bins]
          bins[td.index] = bin
          newCalib = { bins, nms: c.nms }
        }
        td.modified = true
        setCalibration(newCalib, pipeline.numSamples)
        setRuntime({ trimInfo: showTrimmingData(newCalib, td.index) })
        return
      }

      if (drag) {
        const span = drag.endX - drag.startX
        const dPix = e.clientX - drag.x
        const dThousandths = Math.round((-dPix / (rect.width - DEST_LEFT)) * span)
        let start = drag.startX + dThousandths
        let end = drag.endX + dThousandths
        if (start < 0) {
          end -= start
          start = 0
        }
        if (end > 1000) {
          start -= end - 1000
          end = 1000
        }
        setSettings({ StartX: start, EndX: end })
      }
    }

    const onUp = () => {
      drag = null
      if (trimDragRef.current) {
        // Mark as "calibrated" only if actually modified (setCalibration already saved to localStorage in real time)
        if (trimDragRef.current.modified) markCalibrated()
        trimDragRef.current = null
        setRuntime({ trimInfo: null })
      }
      setClipBox(null) // clipboard floating box disappears when the left button is released
    }

    const onLeave = () => {
      mouseRef.current.inside = false
    }

    // Right-click: top scale band = add/delete calibration points (PBox_Spectrum_MouseDown right-button branch)
    const onContextMenu = (e: MouseEvent) => {
      const s = settingsRef.current
      if (!s.TrimScale) return
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      if (my >= TOP_BAND) return // original source: both add and delete are restricted to the top band y<15
      const st = getState()

      const hit = hitTrimPoint(mx, my)
      if (hit) {
        if (st.calibration.bins.length < 3) {
          alert(tRef.current('Msg_CanNotDelete'))
          return
        }
        if (confirm(tRef.current('Msg_Delete'))) {
          const c = removePoint(st.calibration, hit.index)
          if (c) {
            setCalibration(c, pipeline.numSamples)
            markCalibrated()
          }
        }
        return
      }

      if (mx >= DEST_LEFT) {
        const view = viewRef.current
        if (!view) return
        if (confirm(tRef.current('Msg_NewTrimPoint'))) {
          const nm = view.nmStart + (mx - DEST_LEFT) / view.nmCoeff
          const bin = nmToBin(st.calibration, nm)
          setCalibration(addPoint(st.calibration, bin, nm), pipeline.numSamples)
          markCalibrated()
        }
      }
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    canvas.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('mouseup', onUp)
    return () => {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
      canvas.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="spectrum-canvas" />
      {clipBox && (
        <div
          style={{
            position: 'absolute',
            left: clipBox.x,
            top: Math.max(0, clipBox.y),
            width: 90,
            height: 120,
            background: 'lightyellow',
            border: '1px solid green',
            font: '11px Arial',
            padding: 3,
            whiteSpace: 'pre',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {'Clipboard data\n' + clipFifoRef.current.join('\n')}
        </div>
      )}
    </>
  )
})

// Yellow-background label (peak = green border, calibration = red border)
function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  border: string,
) {
  ctx.fillStyle = 'yellow'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = border
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  ctx.fillStyle = 'black'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(text, x + w / 2, y + h / 2 + 1)
  ctx.textAlign = 'left'
}

// Adaptive grid (§8.2)
function drawGrid(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  nmStart: number,
  nmEnd: number,
  nmCoeff: number,
  nmToX: (nm: number) => number,
  maxV: number,
  destH: number,
  logK: number,
) {
  const pens = ['rgb(0,0,0)', 'rgb(100,100,100)', 'rgb(160,160,160)', 'rgb(200,200,200)', 'rgb(230,230,230)']
  ctx.font = '11px Arial'
  ctx.textBaseline = 'alphabetic'

  // Horizontal axis: nm grid
  const steps: { mod: number; penIf: number; pen: number; labelIf: number }[] = [
    { mod: 100, penIf: 0, pen: 0, labelIf: 0 },
    { mod: 50, penIf: 1, pen: 1, labelIf: 2 },
    { mod: 10, penIf: 2, pen: 2, labelIf: 5 },
    { mod: 1, penIf: 20, pen: 3, labelIf: 50 },
    { mod: 0.1, penIf: 40, pen: 4, labelIf: Infinity },
  ]
  const drawn = new Set<number>()
  for (const st of steps) {
    if (nmCoeff <= st.penIf) continue
    const first = Math.ceil(nmStart / st.mod) * st.mod
    for (let nm = first; nm <= nmEnd; nm += st.mod) {
      const key = Math.round(nm * 10)
      if (drawn.has(key)) continue
      drawn.add(key)
      const x = Math.round(nmToX(nm)) + 0.5
      ctx.strokeStyle = pens[st.pen]
      ctx.beginPath()
      ctx.moveTo(x, TOP_BAND)
      ctx.lineTo(x, H)
      ctx.stroke()
      if (nmCoeff > st.labelIf || st.mod === 100) {
        ctx.fillStyle = 'black'
        ctx.textAlign = 'center'
        const label = st.mod < 1 ? nm.toFixed(1) : String(Math.round(nm))
        ctx.fillText(label, x, 11)
      }
    }
  }

  // Vertical axis: one line every 5%; 100%=Pen1, multiples of 10%=Pen2, others=Pen3; value label every 10%
  ctx.textAlign = 'right'
  for (let p = 5; p <= 100; p += 5) {
    const v = (p / 100) * maxV
    const y = Math.round(valueToY(v, maxV, destH, logK)) + 0.5
    ctx.strokeStyle = p === 100 ? pens[0] : p % 10 === 0 ? pens[1] : pens[2]
    ctx.beginPath()
    ctx.moveTo(DEST_LEFT, y)
    ctx.lineTo(W, y)
    ctx.stroke()
    if (p % 10 === 0) {
      ctx.fillStyle = 'black'
      const label = v >= 100000 ? `${Math.round(v / 1000)}K` : String(Math.round(v))
      ctx.fillText(label, 35, y + 4)
    }
  }
  ctx.textAlign = 'left'
}
