// Filters panel (§6.4): Average / Spatial / Rising / Falling / Reference / Background / Reset
import { setSettings, useAppState } from '../app/store'
import { useT } from '../i18n'
import { NumericBox } from '../components/NumericBox'
import { ToggleButton } from '../components/ToggleButton'
import { AVERAGE_OPTIONS } from '../core/settings'
import { doBackground, doReference, doResetSpectrum } from '../app/engine'

export function FiltersPanel() {
  const { settings, runtime } = useAppState()
  const t = useT()

  const avgActive = settings.AverageEnabled
  const avgLabel = avgActive ? String(runtime.averageCounter) : t('Msg_Mean')

  return (
    <div className="group-box">
      <div className="group-box-title">{t('GroupBox_Filters')}</div>
      <div className="field-row">
        <ToggleButton
          active={avgActive}
          activeBackground={avgActive ? 'rgb(255,210,120)' : undefined}
          onClick={() => setSettings({ AverageEnabled: !avgActive })}
          style={{ minWidth: 70 }}
        >
          {avgLabel}
        </ToggleButton>
        <select
          value={settings.Average}
          onChange={(e) => setSettings({ Average: Number(e.target.value) })}
          style={{ width: 64, background: avgActive ? undefined : 'rgb(211,211,211)' }}
        >
          {AVERAGE_OPTIONS.map((v, i) => (
            <option key={v} value={i}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <span className="field-label">{t('Label_SpatialAveraging')}</span>
        <div style={{ flex: 1 }} />
        <NumericBox
          value={settings.SpatialAveraging}
          min={0}
          max={10}
          step={0.2}
          decimals={1}
          defaultValue={0}
          highlight={settings.SpatialAveraging > 0}
          onChange={(v) => setSettings({ SpatialAveraging: v })}
        />
      </div>
      <div className="field-row">
        <span className={`field-label${settings.RisingSpeed < 100 ? ' label-highlight' : ''}`}>
          {t('Label_RisingSpeed')}
        </span>
        <div style={{ flex: 1 }} />
        <NumericBox
          value={settings.RisingSpeed}
          min={1} // original forbids 0 for rising only (0 would freeze the display forever)
          max={100}
          step={0.2}
          decimals={1}
          defaultValue={100}
          highlight={settings.RisingSpeed < 100}
          onChange={(v) => setSettings({ RisingSpeed: v })}
        />
      </div>
      <div className="field-row">
        <span className={`field-label${settings.FallingSpeed < 100 ? ' label-highlight' : ''}`}>
          {t('Label_FallingSpeed')}
        </span>
        <div style={{ flex: 1 }} />
        <NumericBox
          value={settings.FallingSpeed}
          min={0}
          max={100}
          step={0.2}
          decimals={1}
          defaultValue={100}
          highlight={settings.FallingSpeed < 100}
          onChange={(v) => setSettings({ FallingSpeed: v })}
        />
      </div>
      <div className="field-row">
        <ToggleButton active={runtime.referenceOn} onClick={doReference} style={{ flex: 1 }}>
          {t('btn_Reference')}
        </ToggleButton>
        <ToggleButton active={runtime.backgroundOn} onClick={doBackground} style={{ flex: 1 }}>
          {t('btn_Background')}
        </ToggleButton>
      </div>
      <div className="field-row">
        <ToggleButton onClick={doResetSpectrum} style={{ flex: 1 }}>
          {t('btn_ResetSpectrumData')}
        </ToggleButton>
      </div>
    </div>
  )
}
