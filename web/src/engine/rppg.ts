// Camera heart-rate ESTIMATE (remote photoplethysmography) from the mean skin colour
// of a forehead/cheek region, using the POS method:
//   Wang, den Brinker, Stuijk, de Haan (2017) "Algorithmic Principles of Remote PPG",
//   IEEE Trans. Biomed. Eng. 64(7):1479–1491.
// Quality-gated: a weak or ambiguous pulse peak returns ok=false → "No data", never a guess.

export interface RgbSample { t: number; r: number; g: number; b: number } // t in ms
export interface HrEstimate {
  ok: boolean
  bpm?: number
  quality: number // fraction of in-band power at the pulse peak + harmonic (0..1)
  reason: string
}

export const HR_MIN_S = 10
export const HR_QUALITY_MIN = 0.3
const FS = 30
const F_LO = 0.7 // 42 bpm
const F_HI = 3.0 // 180 bpm
const F_BAND_HI = 4.0

function resample(s: RgbSample[]): number[][] {
  const t0 = s[0].t
  const tEnd = s[s.length - 1].t
  const n = Math.floor(((tEnd - t0) / 1000) * FS)
  const out: number[][] = []
  let j = 0
  for (let i = 0; i < n; i++) {
    const t = t0 + (i * 1000) / FS
    while (j < s.length - 2 && s[j + 1].t < t) j++
    const a = s[j], b = s[j + 1]
    const w = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t)
    out.push([a.r + w * (b.r - a.r), a.g + w * (b.g - a.g), a.b + w * (b.b - a.b)])
  }
  return out
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const std = (xs: number[]) => {
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1e-9
}

/** POS pulse signal. */
export function posSignal(rgb: number[][]): number[] {
  const L = Math.round(1.6 * FS)
  const h = new Array(rgb.length).fill(0)
  for (let n = 0; n + L <= rgb.length; n++) {
    const win = rgb.slice(n, n + L)
    const m = [0, 1, 2].map((c) => mean(win.map((x) => x[c])) || 1e-9)
    const s1: number[] = []
    const s2: number[] = []
    for (const [r, g, b] of win) {
      const rn = r / m[0], gn = g / m[1], bn = b / m[2]
      s1.push(gn - bn)
      s2.push(gn + bn - 2 * rn)
    }
    const alpha = std(s1) / std(s2)
    const hw = s1.map((v, i) => v + alpha * s2[i])
    const hm = mean(hw)
    for (let i = 0; i < L; i++) h[n + i] += hw[i] - hm
  }
  return h
}

function power(x: number[], f: number): number {
  let re = 0, im = 0
  const N = x.length
  for (let i = 0; i < N; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)) // Hann
    const a = (2 * Math.PI * f * i) / FS
    re += w * x[i] * Math.cos(a)
    im -= w * x[i] * Math.sin(a)
  }
  return re * re + im * im
}

export function estimateHeartRate(samples: RgbSample[]): HrEstimate {
  if (samples.length < 2 || (samples[samples.length - 1].t - samples[0].t) / 1000 < HR_MIN_S)
    return { ok: false, quality: 0, reason: `Need at least ${HR_MIN_S} s of steady face signal.` }
  const h = posSignal(resample(samples))
  const step = 0.01
  const freqs: number[] = []
  const pw: number[] = []
  for (let f = F_LO; f <= F_BAND_HI + 1e-9; f += step) {
    freqs.push(f)
    pw.push(power(h, f))
  }
  let best = -1
  for (let i = 0; i < freqs.length; i++) if (freqs[i] <= F_HI && (best < 0 || pw[i] > pw[best])) best = i
  const f0 = freqs[best]
  const total = pw.reduce((a, b) => a + b, 0) || 1e-12
  let sig = 0
  for (let i = 0; i < freqs.length; i++)
    if (Math.abs(freqs[i] - f0) <= 0.1 || Math.abs(freqs[i] - 2 * f0) <= 0.2) sig += pw[i]
  const quality = sig / total
  const bpm = Math.round(f0 * 60)
  if (quality < HR_QUALITY_MIN)
    return { ok: false, quality, reason: `Pulse peak too weak (quality ${quality.toFixed(2)} < ${HR_QUALITY_MIN}). Check light and keep still.` }
  return { ok: true, bpm, quality, reason: `Pulse peak at ${bpm} bpm (quality ${quality.toFixed(2)}).` }
}
