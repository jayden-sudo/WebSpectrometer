// Average completion state machine (§6.4): count reached → beep → auto-save data file (incrementing filename)
// → if Repeat is off, auto-disconnect and disable Average
import { subscribeEngineEvent, disconnectCamera } from './engine'
import { getState, setSettings } from './store'
import { getSpectrumText, saveDataFile } from '../core/files'

const LAST_SPECTRUM_KEY = 'webspectrometer.lastSpectrum'

// LastSpectrum (§13.5): written on app close and on Average completion, loaded back at startup
export function writeLastSpectrum(): void {
  try {
    localStorage.setItem(LAST_SPECTRUM_KEY, getSpectrumText())
  } catch {
    // Ignore when quota is full
  }
}

export function readLastSpectrum(): string | null {
  try {
    return localStorage.getItem(LAST_SPECTRUM_KEY)
  } catch {
    return null
  }
}

let audioCtx: AudioContext | null = null

function beep(): void {
  try {
    audioCtx ??= new AudioContext()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3)
    osc.connect(gain).connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.3)
  } catch {
    // Ignore when no audio device is available
  }
}

export function initAverageAutosave(): () => void {
  const unsub = subscribeEngineEvent((e) => {
    if (e !== 'averageDone') return
    beep()
    saveDataFile()
    writeLastSpectrum()
    if (!getState().settings.Repeat) {
      void disconnectCamera()
      setSettings({ AverageEnabled: false, Connected: false })
    }
  })
  const onUnload = () => writeLastSpectrum()
  window.addEventListener('beforeunload', onUnload)
  return () => {
    unsub()
    window.removeEventListener('beforeunload', onUnload)
  }
}
