// "Show me where it hurts": map a fingertip to the body part it is touching, using the
// person's own pose skeleton in the same frame. All in normalised image coordinates.
// Pose landmark sides are the person's own (11 = left shoulder, 12 = right shoulder).
import type { Region } from './triage'
import type { HandTip, PoseFrame } from '../vision/camera'

type Side = 'left' | 'right' | 'middle'
interface Seg { region: Region; side: Side; a: number[]; b: number[]; arm?: 'left' | 'right' }
export interface PointHit { region: Region; side: Side; dist: number; hand: number; tip: [number, number] }

const P = (p: PoseFrame, i: number) => [p.xyv[3 * i] * p.aspect, p.xyv[3 * i + 1], p.xyv[3 * i + 2]]
const mid = (a: number[], b: number[], t = 0.5) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.min(a[2], b[2])]

function distSeg(q: number[], a: number[], b: number[]) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const L = dx * dx + dy * dy || 1e-9
  const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L))
  return Math.hypot(q[0] - (a[0] + t * dx), q[1] - (a[1] + t * dy))
}

/** Body segments from a pose. Facing away from the camera turns the trunk into back regions. */
export function bodySegments(p: PoseFrame): Seg[] {
  const ls = P(p, 11), rs = P(p, 12), le = P(p, 13), re = P(p, 14), lw = P(p, 15), rw = P(p, 16)
  const lh = P(p, 23), rh = P(p, 24), lk = P(p, 25), rk = P(p, 26), la = P(p, 27), ra = P(p, 28)
  const lf = P(p, 31), rf = P(p, 32), nose = P(p, 0), lear = P(p, 7), rear = P(p, 8)
  const sh = mid(ls, rs), hip = mid(lh, rh)
  const facingAway = nose[2] < 0.3 && ls[2] > 0.5 && rs[2] > 0.5
  const upper: Region = facingAway ? 'upper_back' : 'trunk_front'
  const lower: Region = facingAway ? 'lower_back' : 'trunk_front'
  const head = mid(lear, rear)
  const chin = mid(head, sh, 0.55)
  return [
    { region: 'head', side: 'middle', a: head, b: nose },
    { region: 'neck', side: 'middle', a: chin, b: sh },
    { region: 'shoulder', side: 'left', a: ls, b: mid(ls, le, 0.18), arm: 'left' },
    { region: 'shoulder', side: 'right', a: rs, b: mid(rs, re, 0.18), arm: 'right' },
    { region: 'arm', side: 'left', a: mid(ls, le, 0.2), b: le, arm: 'left' },
    { region: 'arm', side: 'right', a: mid(rs, re, 0.2), b: re, arm: 'right' },
    { region: 'arm', side: 'left', a: le, b: lw, arm: 'left' },
    { region: 'arm', side: 'right', a: re, b: rw, arm: 'right' },
    { region: upper, side: 'left', a: mid(ls, lh, 0.1), b: mid(ls, lh, 0.5) },
    { region: upper, side: 'right', a: mid(rs, rh, 0.1), b: mid(rs, rh, 0.5) },
    { region: upper, side: 'middle', a: mid(sh, hip, 0.1), b: mid(sh, hip, 0.5) },
    { region: lower, side: 'middle', a: mid(sh, hip, 0.5), b: mid(sh, hip, 0.9) },
    { region: lower, side: 'left', a: mid(ls, lh, 0.5), b: mid(ls, lh, 0.85) },
    { region: lower, side: 'right', a: mid(rs, rh, 0.5), b: mid(rs, rh, 0.85) },
    { region: 'hip', side: 'left', a: lh, b: mid(lh, lk, 0.12) },
    { region: 'hip', side: 'right', a: rh, b: mid(rh, rk, 0.12) },
    { region: 'thigh', side: 'left', a: mid(lh, lk, 0.15), b: mid(lh, lk, 0.85) },
    { region: 'thigh', side: 'right', a: mid(rh, rk, 0.15), b: mid(rh, rk, 0.85) },
    { region: 'knee', side: 'left', a: mid(lh, lk, 0.88), b: mid(lk, la, 0.12) },
    { region: 'knee', side: 'right', a: mid(rh, rk, 0.88), b: mid(rk, ra, 0.12) },
    { region: 'lower_leg', side: 'left', a: mid(lk, la, 0.15), b: mid(lk, la, 0.9) },
    { region: 'lower_leg', side: 'right', a: mid(rk, ra, 0.15), b: mid(rk, ra, 0.9) },
    { region: 'ankle_foot', side: 'left', a: la, b: lf },
    { region: 'ankle_foot', side: 'right', a: ra, b: rf },
  ].filter((s) => s.a[2] > 0.3 && s.b[2] > 0.3) as Seg[]
}

/**
 * Which body part is a fingertip touching? The hand's own arm is ignored (you cannot
 * point at the forearm you are pointing with). Returns null if no tip is on the body.
 */
export function locateTouch(p: PoseFrame, hands: HandTip[], maxDistSW = 0.32): PointHit | null {
  const segs = bodySegments(p)
  const ls = P(p, 11), rs = P(p, 12), lw = P(p, 15), rw = P(p, 16)
  const sw = Math.hypot(ls[0] - rs[0], ls[1] - rs[1]) || 0.2
  let best: PointHit | null = null
  hands.forEach((h, hi) => {
    const tip = [h.tip[0] * p.aspect, h.tip[1]]
    const wrist = [h.wrist[0] * p.aspect, h.wrist[1]]
    const ownArm: 'left' | 'right' = Math.hypot(wrist[0] - lw[0], wrist[1] - lw[1]) < Math.hypot(wrist[0] - rw[0], wrist[1] - rw[1]) ? 'left' : 'right'
    for (const s of segs) {
      if (s.arm === ownArm) continue
      const d = distSeg(tip, s.a, s.b) / sw
      if (d <= maxDistSW && (!best || d < best.dist)) best = { region: s.region, side: s.side, dist: d, hand: hi, tip: h.tip }
    }
  })
  return best
}

/** Holds a touch steady for `ms` before confirming it. */
export class TouchHold {
  private key = ''
  private since = 0
  private ms: number
  constructor(ms = 1200) { this.ms = ms }
  update(t: number, hit: PointHit | null): { hit: PointHit | null; progress: number; confirmed: boolean } {
    if (!hit) { this.key = ''; return { hit: null, progress: 0, confirmed: false } }
    const k = `${hit.region}:${hit.side}`
    if (k !== this.key) { this.key = k; this.since = t }
    const progress = Math.min(1, (t - this.since) / this.ms)
    return { hit, progress, confirmed: progress >= 1 }
  }
}
