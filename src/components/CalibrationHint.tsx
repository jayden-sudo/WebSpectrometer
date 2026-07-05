// Post-connect uncalibrated reminder (new in web version, bug1.md #1):
// an uncalibrated spectrum is unusable, so prompt the user to calibrate
// with a fluorescent lamp; dismissible.
// All strings come from i18n (web-only keys in src/i18n/extra.ts);
// the menu path is composed from the existing menu translation keys so it
// always matches the current UI language.
import { setRuntime, useAppState } from '../app/store'
import { useT } from '../i18n'

export function CalibrationHint({ onCalibrate }: { onCalibrate: () => void }) {
  const { runtime } = useAppState()
  const t = useT()
  if (!runtime.showCalibrationHint) return null

  const menuPath = `${t('Menu_Tools')} → ${t('Menu_Tools_TrimPoints')} → ${t('Menu_Tools_Trim1')}`
  const msg = t('Msg_NotCalibrated').replace('{path}', menuPath)

  return (
    <div
      style={{
        position: 'fixed',
        top: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2500,
        background: 'rgb(255,245,210)',
        border: '1px solid rgb(200,120,0)',
        boxShadow: '2px 2px 8px rgba(0,0,0,0.3)',
        padding: '10px 14px',
        maxWidth: 560,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ flex: 1 }}>{msg}</span>
      <button
        type="button"
        className="toggle-btn toggle-btn-active"
        onClick={onCalibrate}
        style={{ whiteSpace: 'nowrap' }}
      >
        {t('Msg_CalibrateNow')}
      </button>
      <button
        type="button"
        className="toggle-btn"
        onClick={() => {
          // Ignore: stop reminding for this connection, but do not set the
          // calibrated flag (the reminder returns on the next connect)
          setRuntime({ showCalibrationHint: false })
        }}
      >
        {t('Msg_Ignore')}
      </button>
    </div>
  )
}
