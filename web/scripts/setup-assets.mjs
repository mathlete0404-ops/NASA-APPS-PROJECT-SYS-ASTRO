// Copies MediaPipe wasm from node_modules into public/ (no network) and, with --models,
// downloads the two on-device models so the app works fully offline.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const wasmSrc = join(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const wasmDst = join(root, 'public/mediapipe/wasm')
mkdirSync(wasmDst, { recursive: true })
cpSync(wasmSrc, wasmDst, { recursive: true })
console.log('MediaPipe wasm → public/mediapipe/wasm')

// Draco decoder for the anatomy GLBs (served locally so the 3D body works offline).
const dracoDst = join(root, 'public/draco')
mkdirSync(dracoDst, { recursive: true })
for (const f of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) cpSync(join(root, 'node_modules/three/examples/jsm/libs/draco', f), join(dracoDst, f))
console.log('Draco decoder → public/draco')

const MODELS = {
  'face_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  'pose_landmarker_lite.task': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  'hand_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
}
if (process.argv.includes('--models')) {
  const dir = join(root, 'public/models')
  mkdirSync(dir, { recursive: true })
  for (const [name, url] of Object.entries(MODELS)) {
    const dst = join(dir, name)
    if (existsSync(dst)) { console.log(`${name} already present`); continue }
    const r = await fetch(url)
    if (!r.ok) throw new Error(`${url} → ${r.status}`)
    writeFileSync(dst, Buffer.from(await r.arrayBuffer()))
    console.log(`${name} → public/models`)
  }
} else console.log('Models load from Google’s MediaPipe CDN on first use (run `npm run models` to bundle them for offline use).')
