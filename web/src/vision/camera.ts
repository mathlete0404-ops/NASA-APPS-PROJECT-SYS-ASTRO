// Camera + worker plumbing. The <video> element is never shown and never recorded:
// frames go straight to the worker, and the UI draws only landmark meshes on a dark canvas.

export interface FaceFrame {
  xy: Float32Array
  blink: number
  widthRatio: number | null
  rgb: number[] | null
  faceFrac: number
  nose: [number, number]
  yaw?: number
  /** head height signal for breathing (face-height units) */
  hy?: number
}
/** xyv: image-normalised x, y + visibility. world: 3D metres (x right, y down, z toward camera), hip-centred. */
export interface PoseFrame { xyv: Float32Array; aspect: number; world?: Float32Array | null }
export interface HandTip { tip: [number, number]; wrist: [number, number]; pip: [number, number] }
export type FrameResult = { ts: number; face?: FaceFrame | null; pose?: PoseFrame | null; hands?: HandTip[] }

export class VisionSession {
  private worker: Worker
  private video = document.createElement('video')
  private stream: MediaStream | null = null
  private busy = false
  private running = false
  private raf = 0
  onResult: (r: FrameResult) => void = () => {}
  onError: (msg: string) => void = () => {}

  private task: 'face' | 'pose' | 'point'

  constructor(task: 'face' | 'pose' | 'point') {
    this.task = task
    this.worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' })
    this.video.muted = true
    this.video.playsInline = true
  }

  async start(): Promise<{ delegate: string; model: string }> {
    const ready = new Promise<{ delegate: string; model: string }>((resolve, reject) => {
      this.worker.onmessage = (e) => {
        const m = e.data
        if (m.type === 'ready') resolve(m)
        else if (m.type === 'error') {
          reject(new Error(m.message))
          this.onError(m.message)
        } else if (m.type === 'result') {
          this.busy = false
          this.onResult(m)
        }
      }
    })
    this.worker.postMessage({ type: 'init', task: this.task, base: new URL(import.meta.env.BASE_URL, location.href).href })
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 30 } },
      audio: false,
    })
    this.video.srcObject = this.stream
    await this.video.play()
    const info = await ready
    this.running = true
    this.loop()
    return info
  }

  private loop = async () => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.loop)
    if (this.busy || this.video.readyState < 2) return
    this.busy = true
    try {
      const bitmap = await createImageBitmap(this.video)
      this.worker.postMessage({ type: 'frame', bitmap, ts: performance.now() }, [bitmap])
    } catch {
      this.busy = false
    }
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.worker.terminate()
  }
}

// --------------------------------------------------------------- drawing
const COLORS = { point: '#5eead4', bone: '#93c5fd', off: '#f87171' }

export function drawFace(c: HTMLCanvasElement, f: FaceFrame | null) {
  const g = c.getContext('2d')!
  g.fillStyle = '#050816'
  g.fillRect(0, 0, c.width, c.height)
  if (!f) return
  g.fillStyle = COLORS.point
  for (let i = 0; i < f.xy.length; i += 2) {
    // mirror horizontally so it behaves like a mirror
    g.fillRect((1 - f.xy[i]) * c.width - 1, f.xy[i + 1] * c.height - 1, 2, 2)
  }
}

export const POSE_LINKS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32], [0, 11], [0, 12],
]

export function drawPose(c: HTMLCanvasElement, p: PoseFrame | null, highlight?: number[]) {
  const g = c.getContext('2d')!
  g.fillStyle = '#050816'
  g.fillRect(0, 0, c.width, c.height)
  if (!p) return
  const X = (i: number) => (1 - p.xyv[3 * i]) * c.width
  const Y = (i: number) => p.xyv[3 * i + 1] * c.height
  const V = (i: number) => p.xyv[3 * i + 2]
  g.lineWidth = 4
  g.lineCap = 'round'
  for (const [a, b] of POSE_LINKS) {
    if (V(a) < 0.4 || V(b) < 0.4) continue
    g.strokeStyle = highlight?.includes(a) || highlight?.includes(b) ? COLORS.off : COLORS.bone
    g.beginPath()
    g.moveTo(X(a), Y(a))
    g.lineTo(X(b), Y(b))
    g.stroke()
  }
  g.fillStyle = COLORS.point
  for (let i = 0; i < 33; i++) if (V(i) >= 0.4) g.fillRect(X(i) - 3, Y(i) - 3, 6, 6)
}
