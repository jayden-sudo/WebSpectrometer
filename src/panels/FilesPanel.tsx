// Name and Path panel (§6.3): file name, image format; whole-window drop zone is handled in App
import { setSettings, useAppState } from '../app/store'
import { useT } from '../i18n'

export function FilesPanel() {
  const { settings } = useAppState()
  const t = useT()

  return (
    <div className="group-box">
      <div className="group-box-title">{t('GroupBox_SaveImage')}</div>
      <div className="field-row">
        <input
          className="text-box"
          style={{ flex: 1 }}
          value={settings.FileName}
          onChange={(e) => setSettings({ FileName: e.target.value })}
        />
        <select value={settings.FileFormat} onChange={(e) => setSettings({ FileFormat: e.target.value })}>
          <option value="JPG">JPG</option>
          <option value="PNG">PNG</option>
        </select>
      </div>
      <div className="field-row" style={{ color: 'rgb(120,120,120)' }}>
        {/* The original program has a path box here; the Web version shows a drag-and-drop hint */}
        <span>Drop .txt / .csv here to load a spectrum</span>
      </div>
    </div>
  )
}
