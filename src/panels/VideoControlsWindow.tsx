// Video Input Controls floating panel (§6.2)
// Slider rows are generated dynamically from MediaStreamTrack.getCapabilities(); unsupported capabilities are hidden
import { useCallback, useEffect, useState } from 'react'
import { FloatingWindow } from '../components/FloatingWindow'
import { camera } from '../app/engine'
import { useT } from '../i18n'
// 32×32 slider icons extracted verbatim from the VB.NET Form_VideoInControls.resx (MyButton SideImage)
import icoExposure from './icons/Exposure.png'
import icoGain from './icons/Gain.png'
import icoBrightness from './icons/Brightness.png'
import icoContrast from './icons/Contrast.png'
import icoGamma from './icons/Gamma.png'
import icoBackLight from './icons/BackLight.png'
import icoSaturation from './icons/Saturation.png'
import icoWhiteBalance from './icons/WhiteBalance.png'
import icoHue from './icons/Hue.png'
import icoZoom from './icons/Zoom.png'
import icoPan from './icons/Pan.png'
import icoTilt from './icons/Tilt.png'
import icoSharpness from './icons/Sharpness.png'
import icoFocus from './icons/Focus.png'

// Capability rows in the original program's order (mapping to UVC controls)
const CONTROL_ORDER: { key: string; label: string; icon: string; autoKey?: string }[] = [
  { key: 'exposureTime', label: 'Exposure', icon: icoExposure, autoKey: 'exposureMode' },
  { key: 'gain', label: 'Gain', icon: icoGain },
  { key: 'brightness', label: 'Brightness', icon: icoBrightness },
  { key: 'contrast', label: 'Contrast', icon: icoContrast },
  { key: 'gamma', label: 'Gamma', icon: icoGamma },
  { key: 'backlightCompensation', label: 'Backlight', icon: icoBackLight },
  { key: 'saturation', label: 'Saturation', icon: icoSaturation },
  { key: 'colorTemperature', label: 'WhiteBalance', icon: icoWhiteBalance, autoKey: 'whiteBalanceMode' },
  { key: 'hue', label: 'Hue', icon: icoHue },
  { key: 'zoom', label: 'Zoom', icon: icoZoom },
  { key: 'pan', label: 'Pan', icon: icoPan },
  { key: 'tilt', label: 'Tilt', icon: icoTilt },
  { key: 'sharpness', label: 'Sharpness', icon: icoSharpness },
  { key: 'focusDistance', label: 'Focus', icon: icoFocus, autoKey: 'focusMode' }, // VB Focus slider + Auto
]

interface CapRange {
  min: number
  max: number
  step: number
}

export function VideoControlsWindow({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [pos, setPos] = useState({ x: 340, y: 120 })
  const [, force] = useState(0)

  const track = camera.track
  const caps = (track?.getCapabilities?.() ?? {}) as Record<string, unknown>
  const trackSettings = (track?.getSettings?.() ?? {}) as Record<string, unknown>

  const apply = useCallback(
    (key: string, value: number | string) => {
      void camera.track
        ?.applyConstraints({ advanced: [{ [key]: value } as MediaTrackConstraintSet] })
        .then(() => force((v) => v + 1))
        .catch(() => undefined)
    },
    [],
  )

  // Remember panel position
  useEffect(() => {
    const saved = localStorage.getItem('webspectrometer.videoControlsPos')
    if (saved) {
      try {
        setPos(JSON.parse(saved))
      } catch {
        // ignore
      }
    }
  }, [])
  const onMove = useCallback((x: number, y: number) => {
    setPos({ x, y })
    localStorage.setItem('webspectrometer.videoControlsPos', JSON.stringify({ x, y }))
  }, [])

  const rows = CONTROL_ORDER.filter((c) => {
    const cap = caps[c.key] as CapRange | undefined
    return cap && typeof cap === 'object' && 'min' in cap && 'max' in cap
  })

  return (
    <FloatingWindow
      title={t('Form_VideoInControls')}
      x={pos.x}
      y={pos.y}
      width={400}
      onMove={onMove}
      onClose={onClose}
      className="video-controls-window"
    >
      <div style={{ padding: 8 }}>
        {rows.length === 0 && (
          <div style={{ padding: 12, color: 'rgb(120,120,120)' }}>
            {track ? 'No adjustable controls exposed by this camera' : 'Camera not connected'}
          </div>
        )}
        {rows.map((c) => {
          const cap = caps[c.key] as CapRange
          const cur = Number(trackSettings[c.key] ?? cap.min)
          const autoCap = c.autoKey ? (caps[c.autoKey] as string[] | undefined) : undefined
          const autoOn = c.autoKey ? trackSettings[c.autoKey] === 'continuous' : false
          const isExposure = c.key === 'exposureTime'
          return (
            <div className="field-row" key={c.key}>
              {/* VB.NET: 46×26 icon-only MyButton with the SideImage; label kept as tooltip */}
              <span className="field-label video-control-label" title={c.label}>
                <img className="video-control-icon" src={c.icon} alt={c.label} draggable={false} />
              </span>
              <input
                type="range"
                style={{ flex: 1 }}
                min={cap.min}
                max={cap.max}
                step={cap.step || 1}
                value={cur}
                disabled={autoOn}
                onChange={(e) => {
                  // Turn off Auto before adjusting manually
                  if (c.autoKey && autoOn) apply(c.autoKey, 'manual')
                  apply(c.key, Number(e.target.value))
                }}
              />
              <span style={{ width: isExposure ? 90 : 46, textAlign: 'right' }} title={c.key}>
                {isExposure ? String(cur) : Math.round(cur)}
              </span>
              {autoCap?.includes('continuous') && (
                <label>
                  <input
                    type="checkbox"
                    checked={autoOn}
                    onChange={(e) => apply(c.autoKey!, e.target.checked ? 'continuous' : 'manual')}
                  />
                  {t('Label_Auto')}
                </label>
              )}
              <button
                type="button"
                className="toggle-btn"
                style={{ padding: '1px 6px' }}
                onClick={() => apply(c.key, (cap.min + cap.max) / 2)}
              >
                {t('Label_Default')}
              </button>
            </div>
          )
        })}
        <div className="field-row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            type="button"
            className="toggle-btn"
            onClick={() => {
              for (const c of rows) {
                const cap = caps[c.key] as CapRange
                apply(c.key, (cap.min + cap.max) / 2)
              }
            }}
          >
            {t('btn_DefaultAll')}
          </button>
          <button type="button" className="toggle-btn" onClick={onClose}>
            {t('btn_Close')}
          </button>
        </div>
      </div>
    </FloatingWindow>
  )
}
