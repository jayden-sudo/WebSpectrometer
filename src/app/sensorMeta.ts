// Sensor metadata (single source): shared by the save-file header (§13.1) and Info window (§10)
// Key names and order follow the GetSpectrumText source; the two outputs are no longer maintained separately

import { getState } from './store'
import { camera, lastTcdFrame, pipeline } from './engine'
import { getPeakArea } from '../core/pipeline'
import { AVERAGE_OPTIONS } from '../core/settings'
import {
  TCD_ADC_SPEED_OPTIONS,
  TCD_EXPOSURE_OPTIONS,
  TCD_RESOLUTION_OPTIONS,
  TCD_SCALE_OPTIONS,
} from '../serial/tcd'

export type MetaPair = [key: string, value: string]

// Sensor section (separate fields for WebCam / TCD)
export function sensorMetaPairs(): MetaPair[] {
  const st = getState()
  const s = st.settings
  const pairs: MetaPair[] = []

  if (s.SensorType === 'WebCam') {
    const ts = (camera.track?.getSettings?.() ?? {}) as Record<string, unknown>
    const num = (v: unknown) => (typeof v === 'number' ? String(Math.round(v)) : '')
    // exposureTime unit is 100µs (MediaCapture spec); mimics original format "<step> (<time>)"
    const expo =
      typeof ts.exposureTime === 'number'
        ? `${ts.exposureTime} (${ts.exposureTime >= 10 ? `${Math.round(ts.exposureTime / 10)} mS` : `${ts.exposureTime * 100} µS`})`
        : ''
    pairs.push(['Rec.Samples', st.runtime.resolution || `${pipeline.numSamples} x -`])
    pairs.push(['FramesPerSec', `${st.runtime.fps} fps`])
    pairs.push(['Exposure', expo])
    pairs.push(['Gain', num(ts.gain)])
    pairs.push(['Brightness', num(ts.brightness)])
    pairs.push(['Contrast', num(ts.contrast)])
    pairs.push(['Gamma', num(ts.gamma)])
  } else {
    pairs.push(['ReceivedSamples', st.runtime.resolution])
    pairs.push(['FramesPerSec', `${st.runtime.fps} fps`])
    pairs.push(['Exposure', TCD_EXPOSURE_OPTIONS[s.Exposure] ?? ''])
    pairs.push(['Samples', String(TCD_RESOLUTION_OPTIONS[s.Resolution] ?? pipeline.numSamples)])
    pairs.push(['AdcSpeed', String(TCD_ADC_SPEED_OPTIONS[s.AdcSpeed] ?? 3)])
    pairs.push(['Mode', 'Normal'])
    pairs.push(['AdcScale', `${TCD_SCALE_OPTIONS[s.Scale] ?? 10} bit`])
    pairs.push(['AdcMax', String(s.AdcMax)])
    pairs.push(['AdcMin', String(s.AdcMin)])
    pairs.push(['ReceivedValueMax', String(lastTcdFrame?.valueMax ?? 0)])
    pairs.push(['ReceivedValueMin', String(lastTcdFrame?.valueMin ?? 0)])
  }

  // Common fields (Average always writes the dropdown target value; append " INACTIVE" when disabled)
  pairs.push(['Average', `${AVERAGE_OPTIONS[s.Average] ?? 1}${s.AverageEnabled ? '' : ' INACTIVE'}`])
  pairs.push(['Spatial avg.', String(s.SpatialAveraging)])
  pairs.push(['RisingSpeed', String(s.RisingSpeed)])
  pairs.push(['FallingSpeed', String(s.FallingSpeed)])
  pairs.push(['NanometersMax', pipeline.nmMax.toFixed(2)])
  pairs.push(['NanometersMin', pipeline.nmMin.toFixed(2)])
  pairs.push(['Peak Area', getPeakArea().toFixed(1)])
  return pairs
}
