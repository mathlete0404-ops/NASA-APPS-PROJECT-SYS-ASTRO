// Breathing-rate ESTIMATE from the face scan. Breathing gently lifts and lowers the head
// and modulates skin brightness. We look for a clear rhythm between 6 and 30 breaths/min:
//   1. two signals — head height (5 stable landmarks, scaled by face height) and green skin colour,
//   2. each detrended, windowed and turned into a normalised spectrum, then fused (averaged),
//   3. the fused peak is refined by parabolic interpolation,
//   4. quality = share of in-band power around the peak; on scans ≥ 40 s the two halves must agree.
// Anything unclear returns No data — never a guess.

export interface RespSample { t: number; y: number | null; g: number | null } // t ms
export interface RespEstimate { ok: boolean; bpm?: number; quality: number; source?: 'motion' | 'colour' | 'both'; reason: string }

export const RESP_MIN_S = 24
export const RESP_QUALITY_MIN = 0.35
export const RESP_HALVES_AGREE = 3 // breaths/min
const FS = 10
const F_LO = 0.1 // 6 /min
const F_HI = 0.5 // 30 /min
const DF = 0.005
const FREQS = Array.from({ length: Math.round((0.8 - 0.05) / DF) + 1 }, (_, i) => 0.05 + i * DF)

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
  // remove slow drift (posture changes) with a 12 s moving average
  const k = 6 * FS
  return out.map((v, i) => {
    const w = out.slice(Math.max(0, i - k), i + k + 1)
    return v - w.reduce((x, y) => x + y, 0) / w.length
  })
}

/** Normalised power spectrum (sums to 1 over 0.05–0.8 Hz). */
function spectrum(x: number[]): number[] {
  const N = x.length
  const p = FREQS.map((f) => {
    let re = 0, im = 0
    for (let i = 0; i < N; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
      const a = (2 * Math.PI * f * i) / FS
      re += w * x[i] * Math.cos(a); im -= w * x[i] * Math.sin(a)
    }
    return re * re + im * im
  })
  const tot = p.reduce((a, b) => a + b, 0) || 1e-12
  return p.map((v) => v / tot)
}

function peakOf(p: number[]) {
  let bi = -1
  for (let i = 0; i < FREQS.length; i++) if (FREQS[i] >= F_LO && FREQS[i] <= F_HI && (bi < 0 || p[i] > p[bi])) bi = i
  // parabolic refinement between neighbouring bins
  const y0 = p[bi - 1] ?? p[bi], y1 = p[bi], y2 = p[bi + 1] ?? p[bi]
  const d = y0 - 2 * y1 + y2
  const off = d !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / d)) : 0
  const f = FREQS[bi] + off * DF
  const quality = FREQS.reduce((acc, fr, i) => acc + (Math.abs(fr - FREQS[bi]) <= 0.03 ? p[i] : 0), 0)
  return { f, quality }
}

function estimate(samples: RespSample[]) {
  const ys = samples.filter((s) => s.y != null).map((s) => ({ t: s.t, v: s.y! }))
  const gs = samples.filter((s) => s.g != null).map((s) => ({ t: s.t, v: s.g! }))
  const specs: { src: 'motion' | 'colour'; p: number[] }[] = []
  if (ys.length > 20) specs.push({ src: 'motion', p: spectrum(resample(ys)) })
  if (gs.length > 20) specs.push({ src: 'colour', p: spectrum(resample(gs)) })
  if (!specs.length) return null
  // each source alone, and fused; keep whichever has the clearest peak
  const single = specs.map((s) => ({ src: s.src as 'motion' | 'colour' | 'both', ...peakOf(s.p) }))
  const fused = specs.length > 1 ? [{ src: 'both' as const, ...peakOf(specs[0].p.map((v, i) => (v + specs[1].p[i]) / 2)) }] : []
  return [...single, ...fused].reduce((a, b) => (b.quality > a.quality ? b : a))
}

export function estimateBreathing(samples: RespSample[]): RespEstimate {
  const dur = samples.length > 1 ? (samples[samples.length - 1].t - samples[0].t) / 1000 : 0
  if (dur < RESP_MIN_S) return { ok: false, quality: 0, reason: `Need at least ${RESP_MIN_S} s — use the 60 s scan for breathing rate.` }
  const best = estimate(samples)
  if (!best) return { ok: false, quality: 0, reason: 'No face signal.' }
  const bpm = Math.round(best.f * 60)
  if (best.quality < RESP_QUALITY_MIN)
    return { ok: false, quality: best.quality, reason: `Breathing rhythm unclear (quality ${best.quality.toFixed(2)}). Sit still, face the screen and breathe normally.` }
  if (dur >= 40) {
    const mid = samples[0].t + (dur * 1000) / 2
    const a = estimate(samples.filter((s) => s.t < mid)), b = estimate(samples.filter((s) => s.t >= mid))
    if (a && b && Math.abs(a.f - b.f) * 60 > RESP_HALVES_AGREE)
      return { ok: false, quality: best.quality, reason: `Breathing rhythm changed during the scan (${Math.round(a.f * 60)} then ${Math.round(b.f * 60)} /min). Try again sitting still.` }
  }
  const from = best.src === 'motion' ? 'head motion' : best.src === 'colour' ? 'skin colour' : 'head motion + skin colour'
  return { ok: true, bpm, quality: best.quality, source: best.src, reason: `Steady rhythm at ${bpm}/min from ${from} (quality ${best.quality.toFixed(2)}).` }
}
