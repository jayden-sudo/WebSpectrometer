// Window skeleton (§3): menu bar / toolbar / left-right panels / spectrum area / status bar + Options collapse
import { useCallback, useEffect, useRef, useState } from 'react'
import { MenuBar } from '../menu/MenuBar'
import { TopBar } from '../toolbar/TopBar'
import { VideoInputPanel } from '../panels/VideoInputPanel'
import { SerialPortPanel, SensorPanel } from '../panels/SerialPanels'
import { VideoOptionsPanel } from '../panels/VideoOptionsPanel'
import { VideoControlsWindow } from '../panels/VideoControlsWindow'
import { FiltersPanel } from '../panels/FiltersPanel'
import { FilesPanel } from '../panels/FilesPanel'
import { SensorSamplesPanel } from '../panels/SensorSamplesPanel'
import { InfoWindow } from '../info/InfoWindow'
import { SpectrumView, type SpectrumMeasure } from '../spectrum/SpectrumView'
import { StatusBar } from '../spectrum/StatusBar'
import { useAppState } from './store'
import { loadDataText } from '../core/files'
import { initAverageAutosave, readLastSpectrum } from './averageAutosave'
import { applyTrimPreset, connectCamera } from './engine'
import { CalibrationHint } from '../components/CalibrationHint'

export function App() {
  const { settings } = useAppState()
  const [measure, setMeasure] = useState<SpectrumMeasure | null>(null)
  const [showAbout, setShowAbout] = useState(false)
  const [showVideoControls, setShowVideoControls] = useState(false)
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const settingsInit = useRef(settings)

  useEffect(() => initAverageAutosave(), [])

  // Startup: auto-reconnect if Connected=True; otherwise load back LastSpectrum (§13.5)
  useEffect(() => {
    if (settingsInit.current.Connected) {
      void connectCamera().catch(() => undefined)
    } else {
      const last = readLastSpectrum()
      if (last) void loadDataText(last, 'LastSpectrum')
    }
  }, [])

  // Measurement updates use a ref-throttle to avoid per-frame setState re-rendering the whole tree
  // trailing flush: the last update within the throttle window is applied late, otherwise the status bar keeps stale values when frames stop
  const lastMeasureUpdate = useRef(0)
  const pendingMeasure = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMeasure = useCallback((m: SpectrumMeasure) => {
    const now = performance.now()
    const elapsed = now - lastMeasureUpdate.current
    if (pendingMeasure.current) clearTimeout(pendingMeasure.current)
    if (elapsed > 100) {
      lastMeasureUpdate.current = now
      setMeasure(m)
    } else {
      pendingMeasure.current = setTimeout(() => {
        lastMeasureUpdate.current = performance.now()
        setMeasure(m)
      }, 100 - elapsed)
    }
  }, [])

  const optionsOn = settings.OptionsVisible

  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        // Whole-window drop zone: drop a .txt/.csv to load a spectrum (§6.3)
        e.preventDefault()
        const f = e.dataTransfer.files?.[0]
        if (f && /\.(txt|csv)$/i.test(f.name)) {
          void f.text().then((text) => loadDataText(text, f.name))
        }
      }}
    >
      <MenuBar onAbout={() => setShowAbout(true)} />
      <TopBar spectrumCanvas={() => spectrumCanvasRef.current} />
      <div className="main-area">
        <div className="panels-row">
          {/* §3.2: with Options off, keep Video Input Device (or Serial) + Filters, hide the rest */}
          {/* §3.3: TCD mode replaces left-column panels */}
          <div className="panels-left">
            {settings.SensorType === 'WebCam' ? (
              <>
                <VideoInputPanel />
                {optionsOn && (
                  <VideoOptionsPanel
                    controlsOpen={showVideoControls}
                    onToggleControls={() => setShowVideoControls((v) => !v)}
                  />
                )}
              </>
            ) : (
              <>
                <SerialPortPanel />
                {optionsOn && <SensorPanel />}
              </>
            )}
            {optionsOn && <FilesPanel />}
          </div>
          <div className="panels-right">
            <div className="panels-row" style={{ alignItems: 'stretch' }}>
              <div style={{ width: 300, flexShrink: 0 }}>
                <FiltersPanel />
              </div>
              {optionsOn && (
                <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
                  <SensorSamplesPanel />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="spectrum-area">
          <SpectrumView ref={spectrumCanvasRef} onMeasure={onMeasure} />
        </div>
      </div>
      <StatusBar measure={measure} />
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      {settings.InfoVisible && <InfoWindow />}
      {showVideoControls && <VideoControlsWindow onClose={() => setShowVideoControls(false)} />}
      <CalibrationHint onCalibrate={() => applyTrimPreset(1000, 2000, 436, 546)} />
    </div>
  )
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
      }}
      onClick={onClose}
    >
      <div
        className="group-box"
        style={{ width: 460, padding: 20, textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: 10 }}>Web Spectrometer</h3>
        <p style={{ margin: '8px 0' }}>
          A web-based Spectrometer app with a UI inspired by Theremino Spectrometer
        </p>
        <p style={{ margin: '8px 0' }}>Visible, UVA and Near Infrared Spectrometer</p>
        <p style={{ margin: '8px 0', fontSize: 11, color: 'rgb(90,90,90)' }}>
          Special thanks to{' '}
          <a href="https://www.theremino.com" target="_blank" rel="noreferrer">
            www.theremino.com
          </a>{' '}
          and{' '}
          <a
            href="https://www.maestrodartemestiere.it/it/libro-d-oro/2020/stefano-marchetti"
            target="_blank"
            rel="noreferrer"
          >
            Stefano Marchetti
          </a>{' '}
          for their outstanding work
        </p>
        <p style={{ margin: '8px 0' }}>License: GNU GPL — <a href="https://github.com/jayden-sudo/WebSpectrometer" target="_blank" rel="noreferrer">GitHub</a></p>
        <button type="button" className="toggle-btn" style={{ marginTop: 12, minWidth: 80 }} onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  )
}
