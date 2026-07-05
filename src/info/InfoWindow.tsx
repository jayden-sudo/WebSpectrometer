// Info window (§10): 300×490, magnetic snap, monospace font with PadRight(15) alignment
// Three states: WebCam running / not connected / file mode
import { useEffect, useState } from 'react'
import { FloatingWindow } from '../components/FloatingWindow'
import { setSettings, useAppState } from '../app/store'
import { sensorMetaPairs } from '../app/sensorMeta'
import {
  TCD_ADC_SPEED_OPTIONS,
  TCD_EXPOSURE_OPTIONS,
  TCD_RESOLUTION_OPTIONS,
  tcdFrameMs,
} from '../serial/tcd'

// Integration time (§10): N = ceil(ln(precision)/ln(1−K)), K=(speed/100)^1.5
function integrationTime(speed: number, precision: number, frameMs: number): string {
  const k = Math.pow(speed / 100, 1.5)
  if (k >= 1) return '0 seconds'
  if (k <= 0) return 'INFINITY'
  const n = Math.ceil(Math.log(precision) / Math.log(1 - k))
  const secs = (n * frameMs) / 1000
  if (secs < 60) return `${Math.round(secs)} sec.`
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function pad(name: string): string {
  return name.padEnd(15)
}

export function InfoWindow() {
  const { settings, runtime } = useAppState()
  const [pos, setPos] = useState({
    x: settings.InfoX >= 0 ? settings.InfoX : window.innerWidth - 310,
    y: settings.InfoY >= 0 ? settings.InfoY : 60,
  })
  const [, force] = useState(0)

  // Refresh contents every 500ms (values change)
  useEffect(() => {
    const timer = setInterval(() => force((v) => v + 1), 500)
    return () => clearInterval(timer)
  }, [])

  const lines: string[] = []

  if (runtime.fileMode) {
    // ③ File mode
    lines.push(`FILE: ${runtime.fileMode}`)
    lines.push('-------------------------------')
    lines.push(...runtime.fileMeta)
  } else {
    // ① Running / ② Not connected
    const isTcd = settings.SensorType !== 'WebCam'
    lines.push(
      `Sensor ${settings.SensorType} ${runtime.connected ? 'running' : 'not connected'}`,
    )
    lines.push('-------------------------------')
    // Single source for header fields (shared with the save-file header, see app/sensorMeta.ts)
    for (const [k, v] of sensorMetaPairs()) lines.push(`${pad(k)}${v}`)

    // Integration time: WebCam ms per frame = 1000/measured fps (fps<1 clamps to 1);
    // TCD = sample count×0.026×speed factor + exposure ms + 2 (§10)
    const fps = runtime.fps < 1 ? 1 : runtime.fps
    const frameMs = isTcd
      ? tcdFrameMs(
          TCD_RESOLUTION_OPTIONS[settings.Resolution] ?? 3600,
          TCD_ADC_SPEED_OPTIONS[settings.AdcSpeed] ?? 3,
          TCD_EXPOSURE_OPTIONS[settings.Exposure] ?? '10 mS',
        )
      : 1000 / fps
    lines.push('')
    lines.push('Integration times to precision')
    lines.push('-------------------------------')
    if (settings.RisingSpeed >= 100) {
      lines.push('Rising times =  0 seconds')
    } else {
      lines.push(`Rising time to 10% =  ${integrationTime(settings.RisingSpeed, 0.1, frameMs)}`)
      lines.push(`Rising time to  5% =  ${integrationTime(settings.RisingSpeed, 0.05, frameMs)}`)
      lines.push(`Rising time to  1% =  ${integrationTime(settings.RisingSpeed, 0.01, frameMs)}`)
    }
    if (settings.FallingSpeed >= 100) {
      lines.push('Falling times =  0 seconds')
    } else if (settings.FallingSpeed <= 0) {
      lines.push('Falling time = INFINITY')
    } else {
      lines.push(`Falling time to 10% = ${integrationTime(settings.FallingSpeed, 0.1, frameMs)}`)
      lines.push(`Falling time to  5% = ${integrationTime(settings.FallingSpeed, 0.05, frameMs)}`)
      lines.push(`Falling time to  1% = ${integrationTime(settings.FallingSpeed, 0.01, frameMs)}`)
    }
  }

  return (
    <FloatingWindow
      title="Info"
      x={pos.x}
      y={pos.y}
      width={300}
      height={490}
      magnetic
      onMove={(x, y) => {
        setPos({ x, y })
        setSettings({ InfoX: x, InfoY: y })
      }}
      onClose={() => setSettings({ InfoVisible: false })}
    >
      <div className="info-window-body">{lines.join('\n')}</div>
    </FloatingWindow>
  )
}
