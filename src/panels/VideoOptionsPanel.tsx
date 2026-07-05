// Video Input Options panel (§6.2): Video Input Controls button → floating panel
import { useT } from '../i18n'
import { ToggleButton } from '../components/ToggleButton'

export function VideoOptionsPanel({ controlsOpen, onToggleControls }: { controlsOpen: boolean; onToggleControls: () => void }) {
  const t = useT()

  return (
    <div className="group-box">
      <div className="group-box-title">{t('GroupBox_VideoInOptions')}</div>
      <div className="field-row">
        <ToggleButton active={controlsOpen} onClick={onToggleControls} style={{ flex: 1 }}>
          {t('Btn_VideoInControls')}
        </ToggleButton>
      </div>
    </div>
  )
}
