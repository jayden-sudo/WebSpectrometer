// Bottom status bar (§9)
import { setSettings, useAppState } from '../app/store'
import { useT } from '../i18n'
import { NumericBox } from '../components/NumericBox'
import { ToggleButton } from '../components/ToggleButton'
import type { SpectrumMeasure } from './SpectrumView'

// Peak area format tiers (§9)
function formatPeakArea(v: number): string {
  if (v >= 100000) return `${Math.round(v / 1000)} K`
  if (v >= 10000) return `${(v / 1000).toFixed(1)} K`
  if (v >= 1000) return String(Math.round(v))
  return v.toFixed(1)
}

export function StatusBar({ measure }: { measure: SpectrumMeasure | null }) {
  const { settings, runtime } = useAppState()
  const t = useT()

  // While a calibration point is being adjusted: this area shows the orange-background TRIM message instead (§12.2)
  const measureText = runtime.trimInfo
    ? runtime.trimInfo
    : measure
      ? `${measure.mode === 'value' ? 'Value' : 'Max'} ${Math.round(measure.value)} @ ${measure.nm.toFixed(1)} nm   Peak area ${formatPeakArea(measure.peakArea)}`
      : ''

  return (
    <div className="status-bar">
      <span className={settings.LogScale !== 0 ? 'label-highlight' : ''}>{t('Label_LogScale')}</span>
      <NumericBox
        value={settings.LogScale}
        min={-10}
        max={10}
        defaultValue={0}
        highlight={settings.LogScale !== 0}
        onChange={(v) => setSettings({ LogScale: v })}
      />
      <ToggleButton active={settings.Dips} onClick={() => setSettings({ Dips: !settings.Dips })}>
        {t('btn_Dips')}
      </ToggleButton>
      <ToggleButton active={settings.Peaks} onClick={() => setSettings({ Peaks: !settings.Peaks })}>
        {t('btn_Peaks')}
      </ToggleButton>
      <ToggleButton active={settings.Colors} onClick={() => setSettings({ Colors: !settings.Colors })}>
        {t('btn_Colors')}
      </ToggleButton>
      <span className={`status-measure${runtime.trimInfo ? ' status-trim' : ''}`}>{measureText}</span>
      <div style={{ flex: 1 }} />
      <ToggleButton active={settings.TrimScale} onClick={() => setSettings({ TrimScale: !settings.TrimScale })}>
        {t('btn_TrimScale')}
      </ToggleButton>
    </div>
  )
}
