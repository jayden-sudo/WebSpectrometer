// TCD1304/TCD1254 linear sensors (Web Serial), ported from Module_COM.vb
// Protocol: 1Mbaud 8N1; send "OPTIONS <res> <adcSpeed> <exposure> <debug> <tcd1254>\n";
// receive: 16-byte sync sequence {255..250, 0..9} + N×2 bytes of samples (LE)

export const TCD_START_SEQUENCE = new Uint8Array([255, 254, 253, 252, 251, 250, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

// Cmb_ExposureTime 107 steps (Form1.Designer.vb; index 75 = "1.0 sec" is the auto-exposure upper limit)
export const TCD_EXPOSURE_OPTIONS: string[] = [
  '10 uS', '12 uS', '15 uS', '18 uS', '20 uS', '25 uS', '30 uS', '35 uS', '40 uS', '45 uS',
  '50 uS', '60 uS', '70 uS', '80 uS', '90 uS', '100 uS', '120 uS', '150 uS', '180 uS', '200 uS',
  '250 uS', '300 uS', '350 uS', '400 uS', '450 uS', '500 uS', '600 uS', '700 uS', '800 uS', '900 uS',
  '1.0 mS', '1.2 mS', '1.5 mS', '1.8 mS', '2.0 mS', '2.5 mS', '3.0 mS', '3.5 mS', '4.0 mS', '4.5 mS',
  '5.0 mS', '6.0 mS', '7.0 mS', '8.0 mS', '9.0 mS', '10 mS', '12 mS', '15 mS', '18 mS', '20 mS',
  '25 mS', '30 mS', '35 mS', '40 mS', '45 mS', '50 mS', '60 mS', '70 mS', '80 mS', '90 mS',
  '100 mS', '120 mS', '150 mS', '180 mS', '200 mS', '250 mS', '300 mS', '350 mS', '400 mS', '450 mS',
  '500 mS', '600 mS', '700 mS', '800 mS', '900 mS', '1.0 sec', '1.2 sec', '1.5 sec', '1.8 sec', '2.0 sec',
  '2.5 sec', '3.0 sec', '3.5 sec', '4.0 sec', '4.5 sec', '5.0 sec', '6.0 sec', '7.0 sec', '8.0 sec', '9.0 sec',
  '10 sec', '12 sec', '15 sec', '18 sec', '20 sec', '25 sec', '30 sec', '35 sec', '40 sec', '45 sec',
  '50 sec', '1.0 min', '2.0 min', '3.0 min', '5.0 min', '6.0 min', '8.0 min', '10 min',
]
export const TCD_AUTOEXP_MAX_INDEX = 75 // 1 sec

export const TCD_RESOLUTION_OPTIONS = [3600, 3000, 2500, 2000, 1500, 1200, 1000, 800, 600, 500]
export const TCD_ADC_SPEED_OPTIONS = [3, 2, 1]
// Cmb_Scale: 16~8 bit
export const TCD_SCALE_OPTIONS = [16, 15, 14, 13, 12, 11, 10, 9, 8]

export function exposureToMs(label: string): number {
  const v = Number.parseFloat(label)
  if (label.includes('uS')) return v / 1000
  if (label.includes('mS')) return v
  if (label.includes('sec')) return v * 1000
  if (label.includes('min')) return v * 60000
  return v
}

export interface TcdFrame {
  samples: Float64Array // Raw ADC values (FlipH/FlipV already applied)
  valueMin: number
  valueMax: number
}

export interface TcdOptions {
  resolution: number
  adcSpeed: number
  exposureLabel: string
  isTcd1254: boolean
  flipH: boolean
  flipV: boolean
  adcScale: number // 2^bits
}

export class TcdSerial {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private buffer = new Uint8Array(0)
  private running = false
  // Generation counter: a disconnect while requestPort is pending makes the old connect invalidate itself
  private generation = 0
  onFrame: ((frame: TcdFrame) => void) | null = null
  options: TcdOptions = {
    resolution: 3600,
    adcSpeed: 3,
    exposureLabel: '10 min',
    isTcd1254: false,
    flipH: false,
    flipV: false,
    adcScale: 1024,
  }

  get isOpen(): boolean {
    return this.port !== null
  }

  async connect(): Promise<void> {
    if (!('serial' in navigator))
      throw new Error('Web Serial API not available (use a Chromium-based browser such as Chrome, Edge or Opera)')
    await this.disconnect()
    const gen = ++this.generation
    const port = await navigator.serial.requestPort()
    if (gen !== this.generation) throw new Error('connect cancelled')
    await port.open({ baudRate: 1_000_000, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' })
    if (gen !== this.generation) {
      await port.close().catch(() => undefined)
      throw new Error('connect cancelled')
    }
    this.port = port
    this.writer = this.port.writable?.getWriter() ?? null
    this.running = true
    void this.readLoop()
    await this.sendOptions()
    // OpenComm sends OPTIONS once right after opening and 10 more times (50 ms apart) at the
    // end, so the firmware reliably latches the settings even if the first line was garbled
    await this.sendOptions(10)
  }

  async disconnect(): Promise<void> {
    this.generation++
    this.running = false
    try {
      await this.reader?.cancel()
      this.reader?.releaseLock()
    } catch {
      // ignore
    }
    try {
      this.writer?.releaseLock()
    } catch {
      // ignore
    }
    try {
      await this.port?.close()
    } catch {
      // ignore
    }
    this.reader = null
    this.writer = null
    this.port = null
    this.buffer = new Uint8Array(0)
  }

  // COM_SendOptionsToHardware: OPTIONS <res> <speed> <exposure lowercase without spaces> <debug=0> <tcd1254>
  async sendOptions(repetitions = 1): Promise<void> {
    if (!this.writer) return
    // After an options change (especially resolution), frames of the old record length remaining in the buffer must be discarded, otherwise they would be mis-sliced at the new length
    this.buffer = new Uint8Array(0)
    const o = this.options
    const cmd = `OPTIONS ${o.resolution} ${o.adcSpeed} ${o.exposureLabel.toLowerCase().replace(/\s+/g, '')} 0 ${o.isTcd1254 ? '1' : '0'}\n`
    const bytes = new TextEncoder().encode(cmd)
    for (let i = 0; i < repetitions; i++) {
      await this.writer.write(bytes)
      if (repetitions > 1) await new Promise((r) => setTimeout(r, 50))
    }
  }

  private async readLoop(): Promise<void> {
    for (;;) {
      const readable = this.running ? this.port?.readable : null
      if (!readable) break
      this.reader = readable.getReader()
      try {
        for (;;) {
          const { value, done } = await this.reader.read()
          if (done || !this.running) break
          if (value) this.append(value)
        }
      } catch {
        // Read error: device unplugged, etc.
      } finally {
        try {
          this.reader?.releaseLock()
        } catch {
          // ignore
        }
      }
      if (!this.running) break
    }
  }

  private append(chunk: Uint8Array): void {
    // Accumulation buffer (limit 100000, reset on overflow — matching BufferSize)
    if (this.buffer.length + chunk.length > 100000) {
      this.buffer = new Uint8Array(0)
      return
    }
    const merged = new Uint8Array(this.buffer.length + chunk.length)
    merged.set(this.buffer)
    merged.set(chunk, this.buffer.length)
    this.buffer = merged
    this.extractFrames()
  }

  private extractFrames(): void {
    const recordLength = this.options.resolution * 2 + TCD_START_SEQUENCE.length
    for (;;) {
      const idx = findSequence(this.buffer, TCD_START_SEQUENCE)
      if (idx < 0) {
        // Keep a possible prefix of the sequence
        if (this.buffer.length > TCD_START_SEQUENCE.length) {
          this.buffer = this.buffer.slice(this.buffer.length - TCD_START_SEQUENCE.length)
        }
        return
      }
      if (this.buffer.length - idx < recordLength) {
        this.buffer = this.buffer.slice(idx)
        return
      }
      const payload = this.buffer.subarray(idx + TCD_START_SEQUENCE.length, idx + recordLength)
      this.buffer = this.buffer.slice(idx + recordLength)
      this.decode(payload)
    }
  }

  // LinearSensor_To_ReceivedSamples: LE 16-bit, FlipH reverses the index, FlipV = AdcScale − v
  private decode(payload: Uint8Array): void {
    const n = this.options.resolution
    const { flipH, flipV, adcScale } = this.options
    const samples = new Float64Array(n)
    let min = Number.MAX_VALUE
    let max = -Number.MAX_VALUE
    for (let i = 0; i < n; i++) {
      let v = payload[i * 2] + 256 * payload[i * 2 + 1]
      if (flipV) v = adcScale - v
      if (v < min) min = v
      if (v > max) max = v
      samples[flipH ? n - 1 - i : i] = v
    }
    this.onFrame?.({ samples, valueMin: min, valueMax: max })
  }
}

function findSequence(buf: Uint8Array, seq: Uint8Array): number {
  outer: for (let i = 0; i + seq.length <= buf.length; i++) {
    for (let j = 0; j < seq.length; j++) {
      if (buf[i + j] !== seq[j]) continue outer
    }
    return i
  }
  return -1
}

// Auto exposure (Spectrometer_AutoExposure): target max ∈ [0.75×AdcMax, AdcMax], hysteresis state machine
export class AutoExposure {
  private findMax = false

  // Returns the new exposure index (unchanged = original value)
  step(currentIndex: number, receivedMax: number, adcMax: number): number {
    const tripMax = adcMax
    const tripMin = adcMax * 0.75
    let idx = currentIndex
    if (receivedMax < tripMin) this.findMax = true
    if (this.findMax) {
      if (receivedMax < tripMax) {
        if (idx < TCD_AUTOEXP_MAX_INDEX) idx++
      } else {
        this.findMax = false
      }
    }
    if (receivedMax > tripMax && idx > 0) idx--
    return idx
  }
}

// Frame time (§10): sampleCount×0.026ms×(AdcSpeed=2→×2, =1→×4) + exposure ms + 2
export function tcdFrameMs(resolution: number, adcSpeed: number, exposureLabel: string): number {
  const mult = adcSpeed === 2 ? 2 : adcSpeed === 1 ? 4 : 1
  return resolution * 0.026 * mult + exposureToMs(exposureLabel) + 2
}
