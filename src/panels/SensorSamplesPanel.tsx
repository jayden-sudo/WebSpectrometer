// Sensor samples panel (§7): WebCam ROI preview + AGC + orange frame + wheel zoom + thousandths numeric boxes
// TCD mode: green dot-matrix oscilloscope + AdcMax/AdcMin (§3.3 position swap)
import { useEffect, useRef } from 'react'
import { setSettings, useAppState } from '../app/store'
import { useT } from '../i18n'
import { NumericBox } from '../components/NumericBox'
import { camera, getLastRoi, lastTcdFrame, subscribeFrame, tcd } from '../app/engine'

export function SensorSamplesPanel() {
  const { settings } = useAppState()
  if (settings.SensorType !== 'WebCam') return <TcdSamplesPanel />
  return <WebcamSamplesPanel />
}

function WebcamSamplesPanel() {
  const { settings } = useAppState()
  const t = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const srcCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Sync ROI settings to the camera
  useEffect(() => {
    camera.roi = { startY: settings.StartY, sizeY: settings.SizeY, flipH: settings.FlipH }
  }, [settings.StartY, settings.SizeY, settings.FlipH])

  // Draw ROI preview every frame: AGC gain = min(255/frame max luminance, 100), affects preview only; overlay orange ROI frame
  useEffect(() => {
    return subscribeFrame(() => {
      const canvas = canvasRef.current
      const frame = getLastRoi()
      if (!canvas || !frame) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { roiImage, width } = frame

      // AGC: find ROI max luminance (strided sampling every 4 pixels, no visible difference for max detection)
      const d = roiImage.data
      let maxLum = 1
      for (let i = 0; i < d.length; i += 16) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        if (lum > maxLum) maxLum = lum
      }
      const gain = Math.min(255 / maxLum, 100)

      if (canvas.width !== roiImage.width || canvas.height !== roiImage.height) {
        canvas.width = roiImage.width
        canvas.height = roiImage.height
      }
      // Gain is applied by the GPU via CSS filter, no more per-pixel copy/computation
      if (gain > 1.01) {
        let src = srcCanvasRef.current
        if (!src || src.width !== roiImage.width || src.height !== roiImage.height) {
          src = document.createElement('canvas')
          src.width = roiImage.width
          src.height = roiImage.height
          srcCanvasRef.current = src
        }
        src.getContext('2d')?.putImageData(roiImage, 0, 0)
        ctx.filter = `brightness(${gain})`
        ctx.drawImage(src, 0, 0)
        ctx.filter = 'none'
      } else {
        ctx.putImageData(roiImage, 0, 0)
      }

      // Orange ROI frame RGB(200,120,0), line width = min(18, camera width/panel width*8)
      const panelW = canvas.clientWidth || 280
      const lw = Math.min(18, (width / panelW) * 8)
      ctx.strokeStyle = 'rgb(200,120,0)'
      ctx.lineWidth = lw
      ctx.strokeRect(lw / 2, lw / 2, canvas.width - lw, canvas.height - lw)
    })
  }, [])

  // Wheel: horizontal zoom of Start/End; CTRL+wheel: vertical zoom of ROI (centered on cursor)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -12 : 12
      const rect = canvas.getBoundingClientRect()
      const s = { ...settingsRef.current }
      if (e.ctrlKey) {
        // SizeY -= delta/10 ... centered on the cursor height ratio
        const cursorRatio = 1 - (e.clientY - rect.top) / rect.height
        const d = delta
        setSettings({
          SizeY: Math.max(2, Math.min(1000, s.SizeY - d)),
          StartY: Math.max(0, Math.min(1000, s.StartY + Math.round(d * cursorRatio))),
        })
      } else {
        const k1 = (e.clientX - rect.left) / rect.width
        const dx = delta
        // Same anti-inversion guard as SpectrumView: start ≤ 995 and end ≥ start+5
        let start = Math.max(0, Math.min(995, s.StartX + Math.round(dx * k1)))
        let end = Math.min(1000, s.EndX - Math.round(dx * (1 - k1)))
        end = Math.max(start + 5, end)
        setSettings({ StartX: start, EndX: end })
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  // Lets the wheel handler read the latest settings (avoids stale closure)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  return (
    <div className="group-box" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="group-box-title">{t('GroupBox_Input')}</div>
      <div className="sensor-preview" style={{ flex: 1 }}>
        <canvas ref={canvasRef} />
      </div>
      <div className="field-row" style={{ marginTop: 6 }}>
        <span className="field-label">Size Y</span>
        <NumericBox value={settings.SizeY} min={2} max={1000} onChange={(v) => setSettings({ SizeY: v })} />
        <span className="field-label">Start Y</span>
        <NumericBox value={settings.StartY} min={0} max={1000} onChange={(v) => setSettings({ StartY: v })} />
        <label style={{ marginLeft: 8 }}>
          <input
            type="checkbox"
            checked={settings.FlipH}
            onChange={(e) => setSettings({ FlipH: e.target.checked })}
          />
          {t('chk_FlipH')}
        </label>
      </div>
      <div className="field-row">
        <span className="field-label">{t('Label_StartX')}</span>
        <NumericBox value={settings.StartX} min={0} max={1000} onChange={(v) => setSettings({ StartX: v })} />
        <span className="field-label">{t('Label_EndX')}</span>
        <NumericBox value={settings.EndX} min={0} max={1000} onChange={(v) => setSettings({ EndX: v })} />
      </div>
    </div>
  )
}

// TCD oscilloscope preview (§7): WhiteSmoke background, green 3x3 dots, gray bands = AdcMax/AdcMin clipping,
// yellow-orange frame = visible window, 45px scale at left edge (AdcScale, 0, received Max/Min in dark blue bold)
const SCALE_BORDER = 45

function TcdSamplesPanel() {
  const { settings } = useAppState()
  const t = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const flashRef = useRef(false)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    return subscribeFrame(() => {
      const canvas = canvasRef.current
      const frame = lastTcdFrame
      if (!canvas || !frame) return
      const parent = canvas.parentElement
      if (!parent) return
      const W = parent.clientWidth
      const H = parent.clientHeight
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W
        canvas.height = H
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const s = settingsRef.current
      const adcScale = tcd.options.adcScale
      const plotW = W - SCALE_BORDER
      const n = frame.samples.length

      // Data flashing: alternate background color every frame (FlashComArea)
      flashRef.current = !flashRef.current
      ctx.fillStyle = flashRef.current ? 'rgb(255,220,180)' : 'rgb(255,240,200)'
      ctx.fillRect(0, 0, SCALE_BORDER, H)
      ctx.fillStyle = 'whitesmoke'
      ctx.fillRect(SCALE_BORDER, 0, plotW, H)

      // Gray bands: above AdcMax and below AdcMin (clipping regions)
      ctx.fillStyle = 'rgb(210,210,210)'
      const yMax = (H * (adcScale - s.AdcMax)) / adcScale
      ctx.fillRect(SCALE_BORDER, 0, plotW, Math.max(0, yMax))
      const yMin = (H * s.AdcMin) / adcScale
      ctx.fillRect(SCALE_BORDER, H - Math.max(0, yMin), plotW, Math.max(0, yMin))

      // Grid
      ctx.strokeStyle = 'rgb(160,160,160)'
      for (let i = 0; i <= 100; i += 10) {
        const y = H - (i / 100) * H
        ctx.beginPath()
        ctx.moveTo(SCALE_BORDER, y + 0.5)
        ctx.lineTo(W, y + 0.5)
        ctx.stroke()
      }
      for (let i = 0; i <= 100; i += 5) {
        const x = SCALE_BORDER + (i / 100) * plotW
        ctx.beginPath()
        ctx.moveTo(x + 0.5, 0)
        ctx.lineTo(x + 0.5, H)
        ctx.stroke()
      }

      // Sample dots: RGB(0,180,0) 3x3
      ctx.fillStyle = 'rgb(0,180,0)'
      for (let i = 0; i < n; i++) {
        const x = SCALE_BORDER + (i / n) * plotW
        const y = H - (frame.samples[i] / adcScale) * H
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
      }

      // Visible window frame: RGB(200,180,0), line width 3
      ctx.strokeStyle = 'rgb(200,180,0)'
      ctx.lineWidth = 3
      const x0 = SCALE_BORDER + (s.StartX / 1000) * plotW
      const x1 = SCALE_BORDER + (s.EndX / 1000) * plotW
      ctx.strokeRect(x0, 1.5, x1 - x0, H - 3)
      ctx.lineWidth = 1

      // Left-edge scale: AdcScale value, 0, received Max/Min (dark blue bold)
      ctx.font = 'bold 11px Arial'
      ctx.fillStyle = 'rgb(0,0,120)'
      ctx.textAlign = 'right'
      ctx.fillText(String(adcScale), SCALE_BORDER - 4, 11)
      ctx.fillText('0', SCALE_BORDER - 4, H - 3)
      ctx.fillText(String(Math.round(frame.valueMax)), SCALE_BORDER - 4, H * 0.4)
      ctx.fillText(String(Math.round(frame.valueMin)), SCALE_BORDER - 4, H * 0.6)
      ctx.textAlign = 'left'
    })
  }, [])

  return (
    <div className="group-box" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="group-box-title">{t('GroupBox_Input')}</div>
      <div className="sensor-preview" style={{ flex: 1, background: 'whitesmoke' }}>
        <canvas ref={canvasRef} />
      </div>
      <div className="field-row" style={{ marginTop: 6 }}>
        <span className="field-label">{t('Label_AdcMax')}</span>
        <NumericBox
          value={settings.AdcMax}
          min={1}
          max={65536}
          width={52}
          onChange={(v) => setSettings({ AdcMax: v })}
        />
        <span className="field-label">{t('Label_AdcMin')}</span>
        <NumericBox
          value={settings.AdcMin}
          min={0}
          max={65535}
          width={52}
          onChange={(v) => setSettings({ AdcMin: v })}
        />
        <label>
          <input
            type="checkbox"
            checked={settings.AdcMinAuto}
            onChange={(e) => setSettings({ AdcMinAuto: e.target.checked })}
          />
          {t('chk_AdcMinAuto')}
        </label>
      </div>
      <div className="field-row">
        <span className="field-label">{t('Label_StartX')}</span>
        <NumericBox value={settings.StartX} min={0} max={1000} onChange={(v) => setSettings({ StartX: v })} />
        <span className="field-label">{t('Label_EndX')}</span>
        <NumericBox value={settings.EndX} min={0} max={1000} onChange={(v) => setSettings({ EndX: v })} />
        <label>
          <input type="checkbox" checked={settings.FlipH} onChange={(e) => setSettings({ FlipH: e.target.checked })} />
          {t('chk_FlipH')}
        </label>
        <label>
          <input type="checkbox" checked={settings.FlipV} onChange={(e) => setSettings({ FlipV: e.target.checked })} />
          {t('chk_FlipV')}
        </label>
      </div>
    </div>
  )
}
