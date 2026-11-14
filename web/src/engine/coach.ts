// Camera exercise coach: rep counting and form checks from MediaPipe Pose 3D world
// landmarks (metres, hip-centred), so joint angles do not depend on camera angle/distance.
// Rules are fixed thresholds (documented below) — feedback, not judgement.
import type { PoseFrame } from '../vision/camera'

export type CoachExercise = 'squat' | 'lunge' | 'arm_raise' | 'calf_raise' | 'sit_to_stand'
export interface CoachDef {
  id: CoachExercise
  name: string
  how: string
  view: 'front' | 'side'
  /** Primary angle shown live. */
  angleLabel: string
  needsGravity: boolean
  inFlight: string
  target: number
}

export const COACH: Record<CoachExercise, CoachDef> = {
  squat: { id: 'squat', name: 'Squat', how: 'Feet hip-width, arms forward. Bend until thighs are near level, then stand tall.', view: 'front', angleLabel: 'Knee angle', needsGravity: false, inFlight: 'Only on the resistive device (ARED) or with a bungee harness — the coach still checks depth and knee tracking.', target: 10 },
  lunge: { id: 'lunge', name: 'Split squat / lunge', how: 'One foot forward, one back. Lower the back knee toward the floor, keep the front knee over the foot.', view: 'side', angleLabel: 'Front knee angle', needsGravity: false, inFlight: 'With harness or ARED only.', target: 8 },
  arm_raise: { id: 'arm_raise', name: 'Arm raise (shoulder range)', how: 'Arms by your sides, raise both straight out to the side and overhead, then lower slowly. Press “It hurts here” at the angle pain starts.', view: 'front', angleLabel: 'Shoulder angle', needsGravity: false, inFlight: 'Works the same while floating — anchor feet in foot loops.', target: 8 },
  calf_raise: { id: 'calf_raise', name: 'Calf raise', how: 'Stand tall, hold a rail, rise onto your toes and lower slowly over 3 s. Side view works best.', view: 'side', angleLabel: 'Heel lift', needsGravity: true, inFlight: 'Needs load: treadmill harness or ARED.', target: 15 },
  sit_to_stand: { id: 'sit_to_stand', name: 'Sit-to-stand', how: 'Sit on a chair, arms crossed. Stand up fully, sit down. Whole body in view.', view: 'side', angleLabel: 'Knee angle', needsGravity: true, inFlight: 'Not meaningful while floating — there is no “down”. Use after landing.', target: 5 },
}

type V3 = [number, number, number]
const W = (p: PoseFrame, i: number): V3 => {
  if (p.world) return [p.world[3 * i], p.world[3 * i + 1], p.world[3 * i + 2]]
  return [p.xyv[3 * i] * p.aspect, p.xyv[3 * i + 1], 0]
}
const vis = (p: PoseFrame, i: number) => p.xyv[3 * i + 2]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])

/** Angle ABC in degrees (at B), 3D. */
export function angle3(a: V3, b: V3, c: V3): number {
  const u = sub(a, b), v = sub(c, b)
  const cos = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / ((len(u) * len(v)) || 1e-9)
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}

export interface Joints {
  kneeL: number; kneeR: number; hipL: number; hipR: number; shoulderL: number; shoulderR: number
  trunkLean: number // degrees from vertical
  kneeGap: number; ankleGap: number // metres between knees / ankles (valgus check)
  heelLift: number // metres, ankle above toe line (calf raise)
  ok: boolean
}

export function joints(p: PoseFrame): Joints {
  const g = (i: number) => W(p, i)
  const kneeL = angle3(g(23), g(25), g(27)), kneeR = angle3(g(24), g(26), g(28))
  const hipL = angle3(g(11), g(23), g(25)), hipR = angle3(g(12), g(24), g(26))
  const shoulderL = angle3(g(23), g(11), g(13)), shoulderR = angle3(g(24), g(12), g(14))
  const sh = g(11).map((v, k) => (v + g(12)[k]) / 2) as V3
  const hp = g(23).map((v, k) => (v + g(24)[k]) / 2) as V3
  const trunk = sub(sh, hp)
  const trunkLean = (Math.acos(Math.min(1, Math.abs(trunk[1]) / (len(trunk) || 1e-9))) * 180) / Math.PI
  const kneeGap = Math.hypot(g(25)[0] - g(26)[0], g(25)[2] - g(26)[2])
  const ankleGap = Math.hypot(g(27)[0] - g(28)[0], g(27)[2] - g(28)[2])
  // y is down in world coords: heel lift = how far the ankle rose above the toes vs standing (~0.07 m)
  const heelLift = ((g(31)[1] - g(27)[1]) + (g(32)[1] - g(28)[1])) / 2
  const ok = [11, 12, 23, 24, 25, 26, 27, 28].every((i) => vis(p, i) > 0.5)
  return { kneeL, kneeR, hipL, hipR, shoulderL, shoulderR, trunkLean, kneeGap, ankleGap, heelLift, ok }
}

export interface Rep { n: number; t0: number; t1: number; min: number; max: number; faults: string[] }
export interface CoachState { reps: Rep[]; phase: 'up' | 'down'; live: number; cue: string; faultsNow: string[]; baselineHeel?: number; romMaxL: number; romMaxR: number }

const FAULT_TEXT: Record<string, string> = {
  valgus: 'Knees caving in — push them out over your toes',
  lean: 'Chest dropping — keep your back more upright',
  shallow: 'Go a little deeper if it is pain-free',
  asym: 'Uneven sides — share the load on both legs',
  fast: 'Slow down — about 2 s down, 2 s up',
}
export const faultText = (f: string) => FAULT_TEXT[f] ?? f

/**
 * Rep state machine. Thresholds:
 *   squat/sit-to-stand: down when knee < 115°, up when > 160°; depth goal ≤ 100°
 *   lunge: down when front knee < 110°, up when > 155°
 *   arm raise: up when shoulder > 150°, down when < 40° (records max range per side)
 *   calf raise: up when heel lifts ≥ 3 cm above the standing baseline, down when < 1 cm
 * Faults: knee gap < 70% of ankle gap (valgus), trunk lean > 45°, L/R knee difference > 18°, rising half of a rep < 0.7 s.
 */
export function stepCoach(ex: CoachExercise, s: CoachState, j: Joints, t: number): CoachState {
  if (!j.ok && ex !== 'arm_raise') return { ...s, cue: 'Step back so hips, knees and ankles are in view.' }
  const next: CoachState = { ...s, faultsNow: [] }
  let value = 0, downTh = 0, upTh = 0, lowIsDown = true
  if (ex === 'squat' || ex === 'sit_to_stand') { value = (j.kneeL + j.kneeR) / 2; downTh = 115; upTh = 160 }
  else if (ex === 'lunge') { value = Math.min(j.kneeL, j.kneeR); downTh = 110; upTh = 155 }
  else if (ex === 'arm_raise') {
    value = (j.shoulderL + j.shoulderR) / 2; downTh = 40; upTh = 150; lowIsDown = false
    next.romMaxL = Math.max(s.romMaxL, j.shoulderL); next.romMaxR = Math.max(s.romMaxR, j.shoulderR)
  } else if (ex === 'calf_raise') {
    if (s.baselineHeel == null) next.baselineHeel = j.heelLift
    const base = next.baselineHeel ?? s.baselineHeel ?? j.heelLift
    value = (j.heelLift - base) * 100 // cm
    downTh = 1; upTh = 3; lowIsDown = false
  }
  next.live = Math.round(value)

  if (ex === 'squat' || ex === 'lunge' || ex === 'sit_to_stand') {
    if (ex === 'squat' && j.kneeGap < 0.7 * j.ankleGap && value < 140) next.faultsNow.push('valgus')
    if (j.trunkLean > 45 && value < 140) next.faultsNow.push('lean')
    if (ex === 'squat' && Math.abs(j.kneeL - j.kneeR) > 18 && value < 140) next.faultsNow.push('asym')
  }

  // "active" = the working part of the rep (bottom of a squat, top of a raise)
  const active = lowIsDown ? value < downTh : value > upTh
  const rest = lowIsDown ? value > upTh : value < downTh
  const cur = s.reps[s.reps.length - 1]
  if (s.phase === 'up' && active) {
    next.phase = 'down'
    next.reps = [...s.reps, { n: s.reps.length + 1, t0: t, t1: t, min: value, max: value, faults: [...next.faultsNow] }]
  } else if (s.phase === 'down') {
    const r = { ...cur, min: Math.min(cur.min, value), max: Math.max(cur.max, value), faults: [...new Set([...cur.faults, ...next.faultsNow])] }
    if (rest) {
      r.t1 = t
      if (r.t1 - r.t0 < 700 && ex !== 'calf_raise') r.faults = [...new Set([...r.faults, 'fast'])]
      if (ex === 'squat' && r.min > 100) r.faults = [...new Set([...r.faults, 'shallow'])]
      next.phase = 'up'
    }
    next.reps = [...s.reps.slice(0, -1), r]
  }
  const f = next.faultsNow[0] ?? (next.phase === 'down' && cur?.faults[0])
  next.cue = f ? faultText(f) : next.phase === 'down' ? (lowIsDown ? 'Good — now stand back up' : 'Good — lower slowly') : 'Ready for the next rep'
  return next
}

export const initCoach = (): CoachState => ({ reps: [], phase: 'up', live: 0, cue: 'Get into position', faultsNow: [], romMaxL: 0, romMaxR: 0 })

export function formScore(reps: Rep[]) {
  if (!reps.length) return 0
  return Math.round((100 * reps.filter((r) => r.faults.length === 0).length) / reps.length)
}
