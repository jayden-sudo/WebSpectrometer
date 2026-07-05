// TCD mode left-column panels (§3.3 swap): Serial port + Sensor
import { setSettings, useAppState } from '../app/store'
import { useT } from '../i18n'
import { ConnectButton } from '../components/ConnectButton'
import { connectTcd, syncTcdOptions, tcd } from '../app/engine'
import {
  TCD_ADC_SPEED_OPTIONS,
  TCD_EXPOSURE_OPTIONS,
  TCD_RESOLUTION_OPTIONS,
  TCD_SCALE_OPTIONS,
} from '../serial/tcd'

export function SerialPortPanel() {
  const t = useT()

  return (
    <div className="group-box">
      <div className="group-box-title">{t('GroupBox_Serial')}</div>
      <div className="field-row">
        <span className="field-label">{t('Label_Bauds')}</span>
        <input className="text-box" readOnly value="1000000" style={{ width: 70 }} />
        <div style={{ flex: 1 }} />
        <ConnectButton connect={connectTcd} />
      </div>
      <div className="field-row" style={{ color: 'rgb(120,120,120)' }}>
        <span>Web Serial: port chooser opens on connect</span>
      </div>
    </div>
  )
}

// Shared helper that sends OPTIONS to the hardware
function updateTcd(patch: Parameters<typeof setSettings>[0]) {
  setSettings(patch)
  syncTcdOptions()
  if (tcd.isOpen) void tcd.sendOptions()
}

export function SensorPanel() {
  const { settings } = useAppState()
  const t = useT()

  return (
    <div className="group-box">
      <div className="group-box-title">{t('GroupBox_Sensor')}</div>
      <div className="field-row">
        <span className="field-label">{t('Label_Samples')}</span>
        <select value={settings.Resolution} onChange={(e) => updateTcd({ Resolution: Number(e.target.value) })}>
          {TCD_RESOLUTION_OPTIONS.map((v, i) => (
            <option key={v} value={i}>
              {v}
            </option>
          ))}
        </select>
        <span className="field-label">{t('Label_AdcSpeed')}</span>
        <select value={settings.AdcSpeed} onChange={(e) => updateTcd({ AdcSpeed: Number(e.target.value) })}>
          {TCD_ADC_SPEED_OPTIONS.map((v, i) => (
            <option key={v} value={i}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <span className="field-label">{t('Msg_Exposure')}</span>
        <select
          value={settings.Exposure}
          disabled={settings.AutoExposure}
          onChange={(e) => updateTcd({ Exposure: Number(e.target.value) })}
          style={{ width: 80 }}
        >
          {TCD_EXPOSURE_OPTIONS.map((v, i) => (
            <option key={v} value={i}>
              {v}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={settings.AutoExposure}
            onChange={(e) => setSettings({ AutoExposure: e.target.checked })}
          />
          {t('Msg_AutoExp')}
        </label>
      </div>
      <div className="field-row">
        <span className="field-label">{t('Label_AdcScale')}</span>
        <select value={settings.Scale} onChange={(e) => updateTcd({ Scale: Number(e.target.value) })}>
          {TCD_SCALE_OPTIONS.map((v, i) => (
            <option key={v} value={i}>
              {v} bit
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
