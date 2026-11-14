// Breathing-rate ESTIMATE from the face scan. Breathing moves the head and shoulders
// slightly (and modulates skin brightness); we look for a clear spectral peak between
// 6 and 30 breaths/min in (a) the vertical motion of the nose landmark and (b) the green
// channel, and keep the cleaner one. Quality-gated: an ambiguous peak returns No data.

export interface RespSample { t: number; y: number | null; g: number | null } // t ms
export interface RespEstimate { ok: boolean; bpm?: number; quality: number; source?: 'motion' | 'colour'; reason: string }

export const RESP_MIN_S = 24
export const RESP_QUALITY_MIN = 0.35
const FS = 10
const F_LO = 0.1 // 6 /min
const F_HI = 0.5 // 30 /min

function resample(s: { t: number; v: number }[]): number[] {
  if (s.length < 2) return []
  const t0 = s[0].t, n = Math.floor(((s[s.length - 1].t - t0) / 1000) * FS)
  const out: number[] = []
  let j = 0
  for (let i = 0; i < n; i++) {
    const t = t0 + (i * 1000) / FS
    while (j < s.length - 2 && s[j + 1].t < t) j++
    const a = s[j], b = s[j + 1]
    const w = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t)
    out.push(a.v + w * (b.v - a.v))
  }
  // remove slow drift with a 12 s moving average
  const k = 6 * FS
  return out.map((v, i) => {
    const w = out.slice(Math.max(0, i - k), i + k + 1)
    return v - w.reduce((x, y) => x + y, 0) / w.length
  })
}

function peak(x: number[]) {
  const pw: { f: number; p: number }[] = []
  const N = x.length
  for (let f = 0.05; f <= 0.8 + 1e-9; f += 0.005) {
    let re = 0, im = 0
    for (let i = 0; i < N; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
      const a = (2 * Math.PI * f * i) / FS
      re += w * x[i] * Math.cos(a); im -= w * x[i] * Math.sin(a)
    }
    pw.push({ f, p: re * re + im * im })
  }
  const band = pw.filter((q) => q.f >= F_LO && q.f <= F_HI)
  const best = band.reduce((a, b) => (b.p > a.p ? b : a), band[0])
  const total = pw.reduce((a, b) => a + b.p, 0) || 1e-12
  const sig = pw.filter((q) => Math.abs(q.f - best.f) <= 0.03).reduce((a, b) => a + b.p, 0)
  return { f: best.f, quality: sig / total }
}

export function estimateBreathing(samples: RespSample[]): RespEstimate {
  const dur = samples.length > 1 ? (samples[samples.length - 1].t - samples[0].t) / 1000 : 0
  if (dur < RESP_MIN_S) return { ok: false, quality: 0, reason: `Need at least ${RESP_MIN_S} s — use the 60 s scan for breathing rate.` }
  const cands: { src: 'motion' | 'colour'; f: number; quality: number }[] = []
  const ys = samples.filter((s) => s.y != null).map((s) => ({ t: s.t, v: s.y! }))
  const gs = samples.filter((s) => s.g != null).map((s) => ({ t: s.t, v: s.g! }))
  if (ys.length > 20) cands.push({ src: 'motion', ...peak(resample(ys)) })
  if (gs.length > 20) cands.push({ src: 'colour', ...peak(resample(gs)) })
  if (!cands.length) return { ok: false, quality: 0, reason: 'No face signal.' }
  const best = cands.reduce((a, b) => (b.quality > a.quality ? b : a))
  const bpm = Math.round(best.f * 60)
  if (best.quality < RESP_QUALITY_MIN)
    return { ok: false, quality: best.quality, reason: `Breathing rhythm unclear (quality ${best.quality.toFixed(2)}). Sit still and breathe normally.` }
  return { ok: true, bpm, quality: best.quality, source: best.src, reason: `Rhythm at ${bpm}/min from ${best.src === 'motion' ? 'head motion' : 'skin colour'} (quality ${best.quality.toFixed(2)}).` }
}
