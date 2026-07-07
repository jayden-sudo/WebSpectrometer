// Menu bar (§4): File | Tools | Language | Help | About
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LANGUAGES, translate, type LangCode } from '../i18n'
import { setSettings, useAppState } from '../app/store'
import { loadCalibrationFile, loadDataFile, saveCalibrationAs, loadIrradianceFile } from '../core/files'
import { applyTrimPreset, connectCamera, disconnectCamera } from '../app/engine'
// 16×16 icons extracted verbatim from the VB.NET Form1.resx (Theremino Spectrometer)
import icoLoadDataFile from './icons/loadDataFile.png'
import icoLoadCalibration from './icons/loadCalibration.png'
import icoSaveCalibrationAs from './icons/saveCalibrationAs.png'
import icoLoadIrradianceCoeffs from './icons/loadIrradianceCoeffs.png'
import icoHelpLinkToFiles from './icons/helpLinkToFiles.png'
import icoHelpOpenProgramFolder from './icons/helpOpenProgramFolder.png'
import flagENG from './icons/flagENG.png'
import flagITA from './icons/flagITA.png'
import flagFRA from './icons/flagFRA.png'
import flagPOR from './icons/flagPOR.png'
import flagCHI from './icons/flagCHI.png'

// Language menu flags per Form1.resx (CHT is a web addition — it reuses the CHI flag)
const LANGUAGE_FLAGS: Record<string, string> = {
  ENG: flagENG,
  ITA: flagITA,
  FRA: flagFRA,
  POR: flagPOR,
  CHI: flagCHI,
  CHT: flagCHI,
}

interface MenuDef {
  key: string
  label: string
  items: ReactNode
}

export function MenuBar({ onAbout }: { onAbout: () => void }) {
  const { settings } = useAppState()
  const lang = settings.Language as LangCode
  const t = (k: string) => translate(lang, k)
  const [open, setOpen] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])

  const item = (label: string, onClick?: () => void, checked?: boolean, icon?: string) => (
    <div
      className={`menu-dropdown-item${checked ? ' checked' : ''}${icon ? ' has-icon' : ''}`}
      onClick={() => {
        setOpen(null)
        onClick?.()
      }}
    >
      {icon && <img className="menu-icon" src={icon} alt="" draggable={false} />}
      {label}
    </div>
  )

  const sub = (label: string, children: ReactNode) => <SubMenu label={label}>{children}</SubMenu>

  const menus: MenuDef[] = [
    {
      key: 'file',
      label: t('Menu_File'),
      items: (
        <>
          {item(t('MenuFile_LoadDataFile'), () => void loadDataFile(), undefined, icoLoadDataFile)}
          <div className="menu-separator" />
          {item(t('MenuFile_LoadCalibration'), () => void loadCalibrationFile(), undefined, icoLoadCalibration)}
          {item(t('MenuFile_SaveCalibrationAs'), () => saveCalibrationAs(), undefined, icoSaveCalibrationAs)}
          <div className="menu-separator" />
          {item(t('MenuFile_LoadIrradianceCoeffs'), () => void loadIrradianceFile(), undefined, icoLoadIrradianceCoeffs)}
        </>
      ),
    },
    {
      key: 'tools',
      label: t('Menu_Tools'),
      items: (
        <>
          {sub(
            t('Menu_Tools_SensorType'),
            <>
              {item('Web Cam', () => switchSensor('WebCam'), settings.SensorType === 'WebCam')}
              {item('TCD1304 (Serial)', () => switchSensor('TCD1304'), settings.SensorType === 'TCD1304')}
              {item('TCD1254 (Serial)', () => switchSensor('TCD1254'), settings.SensorType === 'TCD1254')}
            </>,
          )}
          {sub(
            t('Menu_Tools_TrimPoints'),
            <>
              {/* BIN presets per Form1.vb: Trim1 {1000,2000}/3600, Trim2 {1000,2800}/3600 */}
              {item(t('Menu_Tools_Trim1'), () => applyTrimPreset(1000, 2000, 436, 546))}
              {item(t('Menu_Tools_Trim2'), () => applyTrimPreset(1000, 2800, 436, 692))}
            </>,
          )}
          {sub(
            t('Menu_Tools_Separator'),
            <>
              {item(t('Menu_Tools_SeparatorTab'), () => setSettings({ SpectrumFileSeparator: '\t' }), settings.SpectrumFileSeparator === '\t')}
              {item(t('Menu_Tools_SeparatorSemicolon'), () => setSettings({ SpectrumFileSeparator: ';' }), settings.SpectrumFileSeparator === ';')}
              {item(t('Menu_Tools_SeparatorComma'), () => setSettings({ SpectrumFileSeparator: ',' }), settings.SpectrumFileSeparator === ',')}
            </>,
          )}
          {sub(
            t('Menu_Tools_FileType'),
            <>
              {item('TXT', () => setSettings({ SpectrumFileType: 'TXT' }), settings.SpectrumFileType === 'TXT')}
              {item('CSV', () => setSettings({ SpectrumFileType: 'CSV' }), settings.SpectrumFileType === 'CSV')}
            </>,
          )}
        </>
      ),
    },
    {
      key: 'lang',
      label: t('Menu_Language'),
      items: <>{LANGUAGES.map((l) => item(l, () => setSettings({ Language: l }), settings.Language === l, LANGUAGE_FLAGS[l]))}</>,
    },
    {
      key: 'help',
      label: t('Menu_Help'),
      items: (
        <>
          {item(t('Menu_Help_LinkToFiles'), () => window.open('https://www.theremino.com/en/downloads/automation#spectrometer', '_blank'), undefined, icoHelpLinkToFiles)}
          <div className="menu-separator" />
          {item(t('Menu_Help_GitHubReadme'), () => window.open('https://github.com/jayden-sudo/WebSpectrometer#readme', '_blank'), undefined, icoHelpOpenProgramFolder)}
        </>
      ),
    },
  ]

  return (
    <div className="menu-bar" ref={barRef}>
      {menus.map((m) => (
        <div
          key={m.key}
          className={`menu-item${open === m.key ? ' open' : ''}`}
          onClick={() => setOpen(open === m.key ? null : m.key)}
          onMouseEnter={() => open !== null && setOpen(m.key)}
        >
          {m.label}
          {open === m.key && <div className="menu-dropdown" onClick={(e) => e.stopPropagation()}>{m.items}</div>}
        </div>
      ))}
      <div className="menu-item" onClick={onAbout}>
        {t('Menu_About')}
      </div>
    </div>
  )
}

function SubMenu({ label, children }: { label: string; children: ReactNode }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      className="menu-dropdown-item menu-submenu-arrow"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {label}
      {hover && <div className="menu-submenu">{children}</div>}
    </div>
  )
}


// Switch sensor type (§3.3): disconnect, swap panels, then immediately open the new
// sensor (InitSensorType calls OpenWebCam/OpenComm right after switching); the menu click
// is a user gesture, so getUserMedia/requestPort are allowed here
function switchSensor(type: 'WebCam' | 'TCD1304' | 'TCD1254') {
  void disconnectCamera().then(() => {
    setSettings({ SensorType: type, Connected: false })
    return connectCamera()
  }).catch(() => undefined) // user cancelled the device picker → stay disconnected
}
