// Global state: settings (mirrors localStorage) + runtime state
// Uses an external store + useSyncExternalStore so camera/pipeline (non-React) can also read/write

import { useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../core/settings'
import {
  DEFAULT_CALIBRATION,
  DEFAULT_NUM_SAMPLES,
  type Calibration,
  parseCalibration,
  serializeCalibration,
} from '../core/calibration'

export interface RuntimeState {
  connected: boolean
  deviceLabel: string
  resolution: string // "1920 x 1080"
  fps: number
  numSamples: number
  averageCounter: number
  fileMode: string | null // = filename when a data file is loaded
  fileMeta: string[] // file header metadata
  trimInfo: string | null // calibration point being adjusted: orange TRIM display in status bar (§12.2)
  referenceOn: boolean
  backgroundOn: boolean
  // Uncalibrated reminder after connect (new web-version feature, bug1.md #1)
  showCalibrationHint: boolean
}

export interface AppState {
  settings: Settings
  runtime: RuntimeState
  calibration: Calibration
  calibrationSamples: number // baseline sample count for calibration BINs
}

const CALIB_KEY = 'webspectrometer.lastCalibration'

function loadCalibration(): { calib: Calibration; samples: number } {
  try {
    const raw = localStorage.getItem(CALIB_KEY)
    if (raw) {
      const c = parseCalibration(raw, DEFAULT_NUM_SAMPLES)
      if (c) return { calib: c, samples: DEFAULT_NUM_SAMPLES }
    }
  } catch {
    // ignore
  }
  return { calib: DEFAULT_CALIBRATION, samples: DEFAULT_NUM_SAMPLES }
}

const initialCalib = loadCalibration()

let state: AppState = {
  settings: loadSettings(),
  runtime: {
    connected: false,
    deviceLabel: '',
    resolution: '',
    fps: 0,
    numSamples: DEFAULT_NUM_SAMPLES,
    averageCounter: 0,
    fileMode: null,
    fileMeta: [],
    trimInfo: null,
    referenceOn: false,
    backgroundOn: false,
    showCalibrationHint: false,
  },
  calibration: initialCalib.calib,
  calibrationSamples: initialCalib.samples,
}

const listeners = new Set<() => void>()

export function getState(): AppState {
  return state
}

function emit() {
  for (const l of listeners) l()
}

export function setSettings(patch: Partial<Settings>): void {
  state = { ...state, settings: { ...state.settings, ...patch } }
  saveSettings(state.settings)
  emit()
}

export function setRuntime(patch: Partial<RuntimeState>): void {
  state = { ...state, runtime: { ...state.runtime, ...patch } }
  emit()
}

export function setCalibration(calib: Calibration, samples?: number): void {
  const s = samples ?? state.calibrationSamples
  state = { ...state, calibration: calib, calibrationSamples: s }
  try {
    // Write LastCalibration after every calibration operation (§12.3)
    localStorage.setItem(CALIB_KEY, serializeCalibration(calib, s))
  } catch {
    // ignore
  }
  emit()
}

// "User has calibrated" flag: note lastCalibration gets overwritten by the automatic rescale on connect,
// so it cannot serve as evidence the user calibrated; recorded separately
const CALIBRATED_FLAG_KEY = 'webspectrometer.userCalibrated'

export function hasCalibrated(): boolean {
  try {
    return localStorage.getItem(CALIBRATED_FLAG_KEY) === '1'
  } catch {
    return true // no reminder when localStorage is unavailable
  }
}

export function markCalibrated(): void {
  try {
    localStorage.setItem(CALIBRATED_FLAG_KEY, '1')
  } catch {
    // ignore
  }
  if (state.runtime.showCalibrationHint) setRuntime({ showCalibrationHint: false })
}

export function resetSettings(): void {
  state = { ...state, settings: { ...DEFAULT_SETTINGS } }
  saveSettings(state.settings)
  emit()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState)
}
