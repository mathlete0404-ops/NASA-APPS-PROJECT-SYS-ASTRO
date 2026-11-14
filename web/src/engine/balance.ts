// Balance metrics from pose landmarks (MediaPipe Pose, 33 points).
// Sway = RMS displacement of the hip midpoint, scaled by shoulder width (% SW), so
// distance from the camera does not matter. Modelled on clinical posturography tests
// (feet together eyes open / closed, tandem stance) used in NASA post-flight Field Tests.
import type { PoseFrame } from '../vision/camera'
import { median } from './status'

export interface PoseSample { t: number; p: PoseFrame | null }
export interface BalanceResult { value: number | null; ok: boolean; quality: number; pathLen?: number; note: string }

const VIS_MIN = 0.5
const COVER_MIN = 0.8

const pt = (p: PoseFrame, i: number) => ({ x: p.xyv[3 * i] * p.aspect, y: p.xyv[3 * i + 1], v: p.xyv[3 * i + 2] })

export function swayMetrics(samples: PoseSample[], expectedS: number): BalanceResult {
  const good = samples.filter((s) => s.p && [11, 12, 23, 24].every((i) => pt(s.p!, i).v >= VIS_MIN)) as { t: number; p: PoseFrame }[]
  const cover = samples.length ? good.length / samples.length : 0
  const dur = samples.length > 1 ? (samples[samples.length - 1].t - samples[0].t) / 1000 : 0
  if (dur < expectedS * 0.8 || cover < COVER_MIN || good.length < 30)
    return { value: null, ok: false, quality: cover, note: `Shoulders and hips visible ${Math.round(cover * 100)}% of the time (need ${COVER_MIN * 100}%). Step back so your whole upper body is in view.` }

  const raw = good.map((s) => {
    const a = pt(s.p, 23), b = pt(s.p, 24), c = pt(s.p, 11), d = pt(s.p, 12)
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, sw: Math.hypot(c.x - d.x, c.y - d.y) }
  })
  // 5-frame moving average to suppress landmark jitter
  const sm = raw.map((_, i) => {
    const w = raw.slice(Math.max(0, i - 2), i + 3)
    return { x: w.reduce((s, q) => s + q.x, 0) / w.length, y: w.reduce((s, q) => s + q.y, 0) / w.length }
  })
  const sw = median(raw.map((r) => r.sw))
  const mx = sm.reduce((s, q) => s + q.x, 0) / sm.length
  const my = sm.reduce((s, q) => s + q.y, 0) / sm.length
  const rms = Math.sqrt(sm.reduce((s, q) => s + (q.x - mx) ** 2 + (q.y - my) ** 2, 0) / sm.length)
  let path = 0
  for (let i = 1; i < sm.length; i++) path += Math.hypot(sm[i].x - sm[i - 1].x, sm[i].y - sm[i - 1].y)
  const value = Math.round((100 * rms) / sw * 100) / 100
  return { value, ok: true, quality: cover, pathLen: Math.round(((100 * path) / sw / dur) * 10) / 10, note: `RMS hip sway over ${Math.round(dur)} s; path ${(((100 * path) / sw) / dur).toFixed(1)} %SW/s.` }
}

/** Counts sit→stand transitions from hip height relative to torso length. */
export class SitToStand {
  private standing = false
  private stands = 0
  private start: number | null = null
  done: number | null = null
  update(t: number, p: PoseFrame | null): number {
    if (!p || this.done != null) return this.stands
    const hip = (pt(p, 23).y + pt(p, 24).y) / 2
    const sh = (pt(p, 11).y + pt(p, 12).y) / 2
    const knee = (pt(p, 25).y + pt(p, 26).y) / 2
    if ([23, 24, 25, 26, 11, 12].some((i) => pt(p, i).v < VIS_MIN)) return this.stands
    const torso = hip - sh
    if (torso <= 0) return this.stands
    const r = (knee - hip) / torso // ≈0 sitting (thigh horizontal), ≈0.8+ standing
    if (this.start == null) this.start = t
    if (!this.standing && r > 0.55) {
      this.standing = true
      this.stands++
      if (this.stands >= 5) this.done = (t - this.start) / 1000
    } else if (this.standing && r < 0.3) this.standing = false
    return this.stands
  }
}

export type WalkVerdict = { level: 'go' | 'spotter' | 'stop' | 'nodata' | 'baseline'; title: string; detail: string }
