// On-device text reading for food package photos (Tesseract, English LSTM model).
// Every file is served from this app (public/ocr), so it works offline; the photo never
// leaves the device. Loaded only when someone scans a package.
import type { Worker } from 'tesseract.js'

const BASE = import.meta.env.BASE_URL + 'ocr/'
// WebAssembly SIMD check (from wasm-feature-detect): picks the faster core when available.
const SIMD = (() => {
  try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])) } catch { return false }
})()

let worker: Promise<Worker> | null = null
function getWorker(onProgress?: (p: number) => void) {
  worker ??= import('tesseract.js').then(({ createWorker, OEM }) => createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: BASE + 'worker.min.js',
    corePath: BASE + (SIMD ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'),
    langPath: BASE.replace(/\/$/, ''),
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') onProgress?.(m.progress) },
  }))
  worker.catch(() => { worker = null })
  return worker
}

/** Read the text on a photo. Big photos are scaled down first (faster, and enough for labels). */
export async function readPhotoText(file: Blob, onProgress?: (p: number) => void): Promise<string> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  const w = await getWorker(onProgress)
  const { data } = await w.recognize(c)
  return data.text
}
