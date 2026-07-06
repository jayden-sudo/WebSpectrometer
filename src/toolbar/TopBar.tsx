// Top toolbar (§5): Save×3 / TimeBox / Repeat / Options / Info
import { useEffect, useRef, useState } from 'react'
import { ToggleButton } from '../components/ToggleButton'
import { SAVE_TIME_OPTIONS } from '../core/settings'
import { getState, setSettings, useAppState } from '../app/store'
import { useT } from '../i18n'
import { saveDataFile, saveCanvasImage, saveTotalImage } from '../core/files'
import { subscribeFrame } from '../app/engine'

export function TopBar({ spectrumCanvas }: { spectrumCanvas: () => HTMLCanvasElement | null }) {
  const { settings } = useAppState()
  const t = useT()

  // Save data file state machine (§5)
  const [saveState, setSaveState] = useState<'idle' | 'waiting' | 'countdown'>('idle')
  const [remaining, setRemaining] = useState(0)
  const deadlineRef = useRef(0)

  // Read Repeat via ref: toggling it mid-run must not restart the waiting/countdown state machine
  const repeatRef = useRef(settings.Repeat)
  repeatRef.current = settings.Repeat

  // waiting: save as soon as the next frame of data arrives (Repeat on = save every frame)
  // savedOnce guard: with Repeat off, another frame may arrive before setState commits; prevents one click saving multiple files
  useEffect(() => {
    if (saveState !== 'waiting') return
    let savedOnce = false
    return subscribeFrame(() => {
      if (savedOnce && !repeatRef.current) return
      savedOnce = true
      saveDataFile()
      if (!repeatRef.current) setSaveState('idle')
    })
  }, [saveState])

  // countdown: save when the countdown expires; Repeat on → restart the countdown (SaveTime is snapshotted at start, changing it mid-run does not restart)
  useEffect(() => {
    if (saveState !== 'countdown') return
    const secs = SAVE_TIME_OPTIONS[settings.SaveTime]?.seconds ?? 0
    deadlineRef.current = performance.now() + secs * 1000
    setRemaining(secs)
    const timer = setInterval(() => {
      // Autosave_UpdateFromTimer bails while no device is connected: the countdown pauses
      // instead of saving a frozen buffer
      if (!getState().runtime.connected) {
        deadlineRef.current += 250
        return
      }
      const left = (deadlineRef.current - performance.now()) / 1000
      if (left <= 0) {
        saveDataFile()
        if (repeatRef.current) {
          deadlineRef.current = performance.now() + secs * 1000
          setRemaining(secs)
        } else {
          setSaveState('idle')
        }
      } else {
        setRemaining(left)
      }
    }, 250)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveState])

  const fmtCountdown = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const saveDataLabel =
    saveState === 'waiting'
      ? t('Msg_WaitingSamples')
      : saveState === 'countdown'
        ? fmtCountdown(remaining)
        : t('Tools_SaveDataFile')

  const onSaveDataToggle = () => {
    if (saveState !== 'idle') {
      setSaveState('idle')
      return
    }
    // Tools_SaveDataFile_CheckedChanged: while disconnected (e.g. a loaded data file),
    // save the current buffer immediately once instead of arming the autosave machine
    if (!getState().runtime.connected) {
      saveDataFile()
      return
    }
    const secs = SAVE_TIME_OPTIONS[settings.SaveTime]?.seconds ?? 0
    setSaveState(secs === 0 ? 'waiting' : 'countdown')
  }

  return (
    <div className="top-bar">
      <ToggleButton
        onClick={() => {
          const c = spectrumCanvas()
          if (c) saveCanvasImage(c)
        }}
      >
        📷 {t('Tools_SaveSpectrum')}
      </ToggleButton>
      <ToggleButton onClick={() => void saveTotalImage()}>📷 {t('Tools_SaveTotal')}</ToggleButton>
      <ToggleButton active={saveState !== 'idle'} onClick={onSaveDataToggle}>
        🌸 {saveDataLabel}
      </ToggleButton>
      <select
        value={settings.SaveTime}
        onChange={(e) => setSettings({ SaveTime: Number(e.target.value) })}
        style={{ width: 70 }}
      >
        {SAVE_TIME_OPTIONS.map((o, i) => (
          <option key={i} value={i}>
            {o.label}
          </option>
        ))}
      </select>
      <ToggleButton active={settings.Repeat} onClick={() => setSettings({ Repeat: !settings.Repeat })}>
        🌸 {t('Tools_Repeat')}
      </ToggleButton>
      <div style={{ flex: 1 }} />
      <ToggleButton
        active={settings.OptionsVisible}
        onClick={() => setSettings({ OptionsVisible: !settings.OptionsVisible })}
      >
        ⚙ {t('Tools_Options')}
      </ToggleButton>
      <ToggleButton active={settings.InfoVisible} onClick={() => setSettings({ InfoVisible: !settings.InfoVisible })}>
        📋 {t('Tools_Info')}
      </ToggleButton>
    </div>
  )
}
