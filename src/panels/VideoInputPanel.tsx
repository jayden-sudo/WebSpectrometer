// Video Input Device panel (§6.1): device dropdown, read-only resolution/FPS, Connect/Disconnect
import { useEffect, useState } from 'react'
import { setSettings, useAppState } from '../app/store'
import { useT } from '../i18n'
import { connectCamera } from '../app/engine'
import { listVideoDevices } from '../camera/capture'
import { ConnectButton } from '../components/ConnectButton'

export function VideoInputPanel() {
  const { settings, runtime } = useAppState()
  const t = useT()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    void listVideoDevices().then(setDevices)
    const onChange = () => void listVideoDevices().then(setDevices)
    navigator.mediaDevices.addEventListener('devicechange', onChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', onChange)
  }, [runtime.connected])

  const deviceIdx = Number.parseInt(settings.VideoInDevice, 10) || 0

  return (
    <div className="group-box">
      <div className="group-box-title">{t('GroupBox_VideoInDevice')}</div>
      <div className="field-row">
        <select
          style={{ flex: 1, minWidth: 0 }}
          value={deviceIdx}
          onChange={(e) => setSettings({ VideoInDevice: e.target.value })}
        >
          {devices.length === 0 && <option value={0}>0 (camera)</option>}
          {devices.map((d, i) => (
            <option key={d.deviceId || i} value={i}>
              {i} {d.label || `Camera ${i}`}
            </option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <input className="text-box" readOnly value={runtime.resolution} style={{ width: 90 }} />
        <input className="text-box" readOnly value={runtime.fps ? `${runtime.fps}` : ''} style={{ width: 50 }} />
        <div style={{ flex: 1 }} />
        <ConnectButton connect={connectCamera} />
      </div>
    </div>
  )
}
