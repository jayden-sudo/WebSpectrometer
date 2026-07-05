// Settings persistence: INI key/value pairs mirrored to localStorage (§16, §17)
// Note: SaveTime/Average etc. store the dropdown "index", keeping the original program's behavior

export type SensorType = 'WebCam' | 'TCD1304' | 'TCD1254'

export interface Settings {
  // Sensor type (§4.2)
  SensorType: SensorType
  // TCD linear sensor (§17.5; Exposure/Resolution/AdcSpeed/Scale store dropdown indices)
  Exposure: number
  Resolution: number
  AdcSpeed: number
  Scale: number
  AdcMax: number
  AdcMin: number
  AdcMinAuto: boolean
  AutoExposure: boolean
  FlipV: boolean
  // Video/ROI
  VideoInDevice: string
  VideoSize: string
  VideoFPS: number
  StartY: number // 0~1000 per-mille, from the bottom
  SizeY: number
  StartX: number
  EndX: number
  FlipH: boolean
  Connected: boolean
  // Filtering/measurement
  SpatialAveraging: number
  RisingSpeed: number
  FallingSpeed: number
  AverageEnabled: boolean
  Average: number // Dropdown index
  LogScale: number
  Dips: boolean
  Peaks: boolean
  Colors: boolean
  TrimScale: boolean
  // Files
  SpectrumFileSeparator: string
  SpectrumFileType: string
  FileName: string
  FileFormat: string
  SaveTime: number // Dropdown index
  Repeat: boolean
  // Other
  Language: string
  OptionsVisible: boolean
  InfoVisible: boolean
  InfoX: number
  InfoY: number
}

// Defaults match the factory INI (dev_source/Theremino_Spectrometer_INI.txt);
// Intentional deviations: Connected (the Web requires a user gesture to request permission), Language (bug1.md #2, follows the browser)
export const DEFAULT_SETTINGS: Settings = {
  SensorType: 'WebCam',
  Exposure: 57, // "70 mS" (INI Exposure=57)
  Resolution: 0, // 3600
  AdcSpeed: 0, // "3"
  Scale: 6, // 10 bit
  AdcMax: 910,
  AdcMin: 13,
  AdcMinAuto: true,
  AutoExposure: true,
  FlipV: true,
  VideoInDevice: '',
  VideoSize: '1920 x 1080',
  VideoFPS: 30,
  StartY: 439,
  SizeY: 124,
  StartX: 0,
  EndX: 1000,
  FlipH: true, // INI FlipH=True (DIY spectrometer grating imaging is usually mirrored horizontally)
  Connected: false,
  SpatialAveraging: 0,
  RisingSpeed: 100,
  FallingSpeed: 100,
  AverageEnabled: false,
  Average: 2, // Index 2 = "300" (INI Average=2)
  LogScale: 0,
  Dips: false,
  Peaks: true,
  Colors: true,
  TrimScale: false,
  SpectrumFileSeparator: ';',
  SpectrumFileType: 'CSV',
  FileName: 'Test1',
  FileFormat: 'JPG',
  SaveTime: 0,
  Repeat: false,
  Language: 'CHI',
  OptionsVisible: true,
  InfoVisible: false,
  InfoX: -1,
  InfoY: -1,
}

const STORAGE_KEY = 'webspectrometer.settings'

// Default language follows the browser language (bug1.md #2); a manually set language (stored in settings) takes precedence
function detectBrowserLanguage(): string {
  const lang = (navigator.language || '').toLowerCase()
  if (lang.startsWith('zh')) {
    // Traditional-Chinese regions → CHT, other Chinese → CHI
    return /tw|hk|mo|hant/.test(lang) ? 'CHT' : 'CHI'
  }
  if (lang.startsWith('it')) return 'ITA'
  if (lang.startsWith('fr')) return 'FRA'
  if (lang.startsWith('pt')) return 'POR'
  if (lang.startsWith('en')) return 'ENG'
  return 'ENG'
}

export function loadSettings(): Settings {
  const defaults = { ...DEFAULT_SETTINGS, Language: detectBrowserLanguage() }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    // Stored settings (including a manually chosen language) override defaults
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return defaults
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

// Write back changes debounced by 300ms
export function saveSettings(s: Settings): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch {
      // Ignore when localStorage is unavailable
    }
  }, 300)
}

// TimeBox 53 options (§5)
export const SAVE_TIME_OPTIONS: { label: string; seconds: number }[] = [
  { label: '0 sec', seconds: 0 },
  ...[1.0, 1.2, 1.5, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0, 7.0, 8.0, 9.0].map((s) => ({
    label: s.toFixed(1),
    seconds: s,
  })),
  ...[10, 12, 15, 18, 20, 25, 30, 35, 40].map((s) => ({ label: String(s), seconds: s })),
  { label: '45 sec', seconds: 45 },
  ...[1.0, 1.5, 2.0, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0, 7.0, 8.0, 9.0].map((m) => ({
    label: m === Math.floor(m) ? m.toFixed(1) : String(m),
    seconds: m * 60,
  })),
  ...[10, 12, 15, 20, 25, 30].map((m) => ({ label: String(m), seconds: m * 60 })),
  { label: '45 min', seconds: 45 * 60 },
  ...[1, 2, 3, 6, 8, 12, 16].map((h) => ({ label: String(h), seconds: h * 3600 })),
  { label: '24 hrs', seconds: 24 * 3600 },
]

// Average count dropdown, 13 options
export const AVERAGE_OPTIONS = [1000, 500, 300, 200, 100, 50, 30, 20, 10, 5, 3, 2, 1]
