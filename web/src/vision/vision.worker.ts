/// <reference lib="webworker" />
// MediaPipe runs here, off the main thread (detectForVideo blocks). Frames arrive as
// ImageBitmaps and are closed after use; only numbers and landmark coordinates go back.
import { FaceLandmarker, FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision'

type Task = 'face' | 'pose' | 'point'
type Model = 'face' | 'pose' | 'hand'
let face: FaceLandmarker | null = null
let pose: PoseLandmarker | null = null
let hand: HandLandmarker | null = null
let task: Task = 'face'
let canvas: OffscreenCanvas | null = null
let ctx: OffscreenCanvasRenderingContext2D | null = null

const REMOTE: Record<Model, string> = {
  face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  hand: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
}
const LOCAL: Record<Model, string> = { face: 'models/face_landmarker.task', pose: 'models/pose_landmarker_lite.task', hand: 'models/hand_landmarker.task' }

// Forehead + both cheeks: skin regions with good pulse signal and few edges.
const FOREHEAD = [67, 109, 10, 338, 297, 107, 9, 336]
const CHEEK_L = 50
const CHEEK_R = 280

async function create(t: Model, base: string, delegate: 'GPU' | 'CPU', model: string) {
  const fileset = await FilesetResolver.forVisionTasks(base + 'mediapipe/wasm', true)
  if (t === 'hand')
    return HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: model, delegate },
      runningMode: 'VIDEO', numHands: 2,
    })
  if (t === 'face')
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: model, delegate },
      runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
    })
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: model, delegate },
    runningMode: 'VIDEO', numPoses: 1,
  })
}

async function load(m: Model, base: string) {
  const local = base + LOCAL[m]
  const hasLocal = await fetch(local, { method: 'HEAD' }).then((r) => r.ok && !(r.headers.get('content-type') ?? '').includes('html')).catch(() => false)
  const model = hasLocal ? local : REMOTE[m]
  let delegate: 'GPU' | 'CPU' = 'GPU'
  let runner
  try {
    runner = await create(m, base, 'GPU', model)
  } catch {
    delegate = 'CPU'
    runner = await create(m, base, 'CPU', model)
  }
  if (m === 'face') face = runner as FaceLandmarker
  else if (m === 'pose') pose = runner as PoseLandmarker
  else hand = runner as HandLandmarker
  return { delegate, model: hasLocal ? 'local' : 'remote' }
}

async function init(t: Task, base: string) {
  task = t
  const info = t === 'point' ? (await load('pose', base), await load('hand', base)) : await load(t, base)
  postMessage({ type: 'ready', ...info })
}

// Skin patches are smoothed over time: landmark jitter of a pixel moves a raw patch over
// differently lit skin, and that brightness change is far larger than the pulse itself.
let boxPrev: [number, number, number, number][] | null = null
const BOX_ALPHA = 0.15

function meanRgb(bm: ImageBitmap, pts: { x: number; y: number }[], w: number, h: number) {
  if (!canvas || canvas.width !== w || canvas.height !== h) {
    canvas = new OffscreenCanvas(w, h)
    ctx = canvas.getContext('2d', { willReadFrequently: true })
  }
  if (!ctx) return null
  ctx.drawImage(bm, 0, 0)
  let boxes: [number, number, number, number][] = []
  const fx = FOREHEAD.map((i) => pts[i].x * w)
  const fy = FOREHEAD.map((i) => pts[i].y * h)
  const x0 = Math.min(...fx), x1 = Math.max(...fx), y0 = Math.min(...fy), y1 = Math.max(...fy)
  const shrink = (x1 - x0) * 0.15
  boxes.push([x0 + shrink, y0 + (y1 - y0) * 0.2, x1 - x0 - 2 * shrink, (y1 - y0) * 0.6])
  const faceW = Math.abs(pts[454].x - pts[234].x) * w
  const s = faceW * 0.16
  for (const i of [CHEEK_L, CHEEK_R]) boxes.push([pts[i].x * w - s / 2, pts[i].y * h - s / 2, s, s])
  // smooth the patches; restart if the face jumped (more than a quarter of a patch)
  if (boxPrev && boxes.every((b, k) => Math.hypot(b[0] - boxPrev![k][0], b[1] - boxPrev![k][1]) < 0.25 * Math.max(b[2], b[3])))
    boxes = boxes.map((b, k) => b.map((v, j) => boxPrev![k][j] + BOX_ALPHA * (v - boxPrev![k][j])) as [number, number, number, number])
  boxPrev = boxes
  let r = 0, g = 0, b = 0, n = 0
  for (const [bx, by, bw, bh] of boxes) {
    const X = Math.max(0, Math.round(bx)), Y = Math.max(0, Math.round(by))
    const W = Math.min(w - X, Math.round(bw)), H = Math.min(h - Y, Math.round(bh))
    if (W < 2 || H < 2) continue
    const d = ctx.getImageData(X, Y, W, H).data
    for (let k = 0; k < d.length; k += 4) {
      r += d[k]; g += d[k + 1]; b += d[k + 2]; n++
    }
  }
  return n ? [r / n, g / n, b / n] : null
}

function onFrame(bm: ImageBitmap, ts: number) {
  const w = bm.width, h = bm.height
  try {
    if (task === 'face' && face) {
      const res = face.detectForVideo(bm, ts)
      const pts = res.faceLandmarks[0]
      if (!pts) { boxPrev = null; return postMessage({ type: 'result', ts, face: null }) }
      const bs = res.faceBlendshapes[0]?.categories ?? []
      const score = (n: string) => bs.find((c) => c.categoryName === n)?.score ?? 0
      const dist = (a: number, b: number) => Math.hypot((pts[a].x - pts[b].x) * w, (pts[a].y - pts[b].y) * h)
      const ipd = dist(468, 473)
      const rgb = meanRgb(bm, pts, w, h)
      const xy = new Float32Array(pts.length * 2)
      pts.forEach((p, i) => { xy[2 * i] = p.x; xy[2 * i + 1] = p.y })
      postMessage({
        type: 'result', ts,
        face: {
          xy, blink: (score('eyeBlinkLeft') + score('eyeBlinkRight')) / 2,
          widthRatio: ipd > 0 ? dist(234, 454) / ipd : null,
          rgb, faceFrac: Math.abs(pts[454].x - pts[234].x),
          nose: [pts[1].x, pts[1].y],
          // head turn: nose offset from the cheek midpoint, as a share of face width
          yaw: (pts[1].x - (pts[234].x + pts[454].x) / 2) / (Math.abs(pts[454].x - pts[234].x) || 1),
          // breathing: mean height of five stable points, scaled by face height (distance-independent)
          hy: ([1, 10, 152, 234, 454].reduce((acc, i) => acc + pts[i].y, 0) / 5) / (Math.abs(pts[152].y - pts[10].y) || 1),
        },
      }, { transfer: [xy.buffer] })
    } else if (task === 'point' && pose && hand) {
      const pr = pose.detectForVideo(bm, ts)
      const hr = hand.detectForVideo(bm, ts)
      const pts = pr.landmarks[0]
      const xyv = pts ? new Float32Array(pts.length * 3) : null
      pts?.forEach((p, i) => { xyv![3 * i] = p.x; xyv![3 * i + 1] = p.y; xyv![3 * i + 2] = p.visibility ?? 0 })
      // index fingertip (8) and wrist (0) of each detected hand, image-normalised
      const hands = hr.landmarks.map((h) => ({ tip: [h[8].x, h[8].y], wrist: [h[0].x, h[0].y], pip: [h[6].x, h[6].y] }))
      postMessage({ type: 'result', ts, pose: xyv ? { xyv, aspect: w / h } : null, hands }, xyv ? { transfer: [xyv.buffer] } : undefined)
    } else if (task === 'pose' && pose) {
      const res = pose.detectForVideo(bm, ts)
      const pts = res.landmarks[0]
      if (!pts) return postMessage({ type: 'result', ts, pose: null })
      const xyv = new Float32Array(pts.length * 3)
      pts.forEach((p, i) => { xyv[3 * i] = p.x; xyv[3 * i + 1] = p.y; xyv[3 * i + 2] = p.visibility ?? 0 })
      // 3D world landmarks: metres, origin between the hips (camera-independent joint angles)
      const wl = res.worldLandmarks[0]
      const world = wl ? new Float32Array(wl.length * 3) : null
      wl?.forEach((p, i) => { world![3 * i] = p.x; world![3 * i + 1] = p.y; world![3 * i + 2] = p.z })
      postMessage({ type: 'result', ts, pose: { xyv, aspect: w / h, world } }, { transfer: world ? [xyv.buffer, world.buffer] : [xyv.buffer] })
    }
  } finally {
    bm.close()
  }
}

self.onmessage = async (e: MessageEvent) => {
  const m = e.data
  try {
    if (m.type === 'init') await init(m.task, m.base)
    else if (m.type === 'frame') onFrame(m.bitmap, m.ts)
  } catch (err) {
    postMessage({ type: 'error', message: String((err as Error)?.message ?? err) })
  }
}
