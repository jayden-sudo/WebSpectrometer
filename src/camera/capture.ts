// WebCam capture (§7, §11 ①②③): getUserMedia + requestVideoFrameCallback
// Per frame: FlipH → ROI (per-mille, Y measured from the bottom) → per-column BT.601 luminance → callback

export interface RoiConfig {
  startY: number // 0~1000 per-mille, from the bottom
  sizeY: number
  flipH: boolean
}

export interface FrameResult {
  samples: Float64Array // Per-column luminance 0~255, length = image width
  roiImage: ImageData // ROI strip (for preview; cropped, no AGC applied)
  width: number
  height: number
}

export type FrameCallback = (frame: FrameResult) => void

export class CameraCapture {
  private stream: MediaStream | null = null
  private video: HTMLVideoElement
  private canvas: OffscreenCanvas | null = null
  private ctx: OffscreenCanvasRenderingContext2D | null = null
  private running = false
  private frameTimes: number[] = []
  // Generation counter: if disconnect happens during connect's long await (permission prompt), the old connect must invalidate itself when it resumes
  private generation = 0
  roi: RoiConfig = { startY: 439, sizeY: 124, flipH: false }
  onFrame: FrameCallback | null = null
  onFps: ((fps: number) => void) | null = null

  constructor() {
    this.video = document.createElement('video')
    this.video.muted = true
    this.video.playsInline = true
  }

  get track(): MediaStreamTrack | null {
    return this.stream?.getVideoTracks()[0] ?? null
  }

  async connect(deviceId: string | undefined, width: number, height: number, fps: number): Promise<{ width: number; height: number }> {
    await this.disconnect()
    const gen = ++this.generation
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: fps },
      },
      audio: false,
    })
    if (gen !== this.generation) {
      // Disconnected while waiting (e.g. switching sensors): abandon this connection attempt
      for (const t of stream.getTracks()) t.stop()
      throw new Error('connect cancelled')
    }
    this.stream = stream
    this.video.srcObject = this.stream
    await this.video.play()
    if (gen !== this.generation) {
      for (const t of stream.getTracks()) t.stop()
      throw new Error('connect cancelled')
    }
    const w = this.video.videoWidth
    const h = this.video.videoHeight
    this.canvas = new OffscreenCanvas(w, h)
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    this.running = true
    this.scheduleFrame()
    return { width: w, height: h }
  }

  async disconnect(): Promise<void> {
    this.generation++
    this.running = false
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop()
      this.stream = null
    }
    this.video.srcObject = null
    this.frameTimes = []
  }

  private scheduleFrame() {
    if (!this.running) return
    this.video.requestVideoFrameCallback((now) => {
      this.processFrame(now)
      this.scheduleFrame()
    })
  }

  private processFrame(now: number) {
    if (!this.running || !this.ctx || !this.canvas) return
    const w = this.video.videoWidth
    const h = this.video.videoHeight
    if (w === 0 || h === 0) return

    // FPS measurement (sliding window)
    this.frameTimes.push(now)
    if (this.frameTimes.length > 30) this.frameTimes.shift()
    if (this.frameTimes.length >= 2 && this.onFps) {
      const dt = (this.frameTimes[this.frameTimes.length - 1] - this.frameTimes[0]) / (this.frameTimes.length - 1)
      this.onFps(dt > 0 ? 1000 / dt : 0)
    }

    // ② ROI: SrcDY = H×SizeY\1000; SrcY0 = H − H×StartY\1000 − SrcDY (Y measured from the bottom;
    // truncating integer division and clamp order per ProcessCapturedImage AREA Y)
    let srcDY = Math.trunc((h * this.roi.sizeY) / 1000)
    let srcY0 = h - Math.trunc((h * this.roi.startY) / 1000) - srcDY
    if (srcY0 + srcDY > h) srcDY = h - srcY0
    if (srcDY <= 0) {
      srcY0 += srcDY - 1
      srcDY = 1
    }
    if (srcY0 < 0) srcY0 = 0

    // Rasterize only the ROI strip (canvas size = w × srcDY), avoiding drawing the whole frame just to read back a small strip
    if (this.canvas.width !== w || this.canvas.height !== srcDY) {
      this.canvas.width = w
      this.canvas.height = srcDY
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })
      if (!this.ctx) return
    }
    const ctx = this.ctx
    // ① FlipH horizontal flip (for the ROI strip this is equivalent to flipping the whole frame)
    if (this.roi.flipH) {
      ctx.save()
      ctx.scale(-1, 1)
      ctx.drawImage(this.video, 0, srcY0, w, srcDY, -w, 0, w, srcDY)
      ctx.restore()
    } else {
      ctx.drawImage(this.video, 0, srcY0, w, srcDY, 0, 0, w, srcDY)
    }

    const img = ctx.getImageData(0, 0, w, srcDY)
    const data = img.data

    // ③ Per-column luminance BT.601: v[x] = Σrows(0.299R+0.587G+0.114B)/SrcDY
    const samples = new Float64Array(w)
    for (let y = 0; y < srcDY; y++) {
      let p = y * w * 4
      for (let x = 0; x < w; x++, p += 4) {
        samples[x] += 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
      }
    }
    for (let x = 0; x < w; x++) samples[x] /= srcDY

    this.onFrame?.({ samples, roiImage: img, width: w, height: h })
  }
}

export async function listVideoDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((d) => d.kind === 'videoinput')
}
