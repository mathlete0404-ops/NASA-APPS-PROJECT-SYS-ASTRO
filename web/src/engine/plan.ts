// Today's plan: fixed rules that turn statuses, symptoms and phase into actions.
// Every recommendation carries "because" — the data that triggered it.
import type { State } from '../data/store'
import { crewStatus, dayKey, history, microgravityDays } from '../data/store'
import type { CrewProfile } from '../data/types'
import { METRICS } from './status'
import { PHASES, type Phase } from '../content/mission'
import { REGION_LABEL } from '../content/cards'
import type { Region } from './triage'

export type Area = 'medical' | 'check' | 'sleep' | 'fluid' | 'exercise' | 'nutrition' | 'balance' | 'recovery'
export interface Rec { id: string; area: Area; priority: number; title: string; detail: string; because: string[]; action?: { tab: string; label: string } }
export interface PlanItem { id: string; label: string; detail: string; minutes: number; coach?: string; done?: boolean; skip?: string }

const RECENT = 7 * 86_400_000
const why = (id: string, r: { value?: number; z?: number; level: string }) => `${METRICS[id].label} ${r.value != null ? `${+r.value.toFixed(2)} ${METRICS[id].unit}` : ''} (${r.level}${r.z != null ? `, z ${r.z > 0 ? '+' : ''}${r.z}` : ''})`

export function latestMass(s: State, crewId: string): number | null {
  const h = history(s.sessions, crewId, 'body_mass').filter((x) => x.ok && x.value != null)
  return h.length ? h[h.length - 1].value : null
}

export function recommendations(s: State, p: CrewProfile): Rec[] {
  const out: Rec[] = []
  const st = crewStatus(s, p.id)
  const lvl = (id: string) => st[id]?.level
  const bad = (id: string) => lvl(id) === 'act' || lvl(id) === 'watch'
  const today = dayKey(new Date())
  const recentSym = s.symptoms.filter((x) => x.crewId === p.id && Date.now() - Date.parse(x.ts) < RECENT)

  for (const r of recentSym.filter((x) => x.result.level !== 'self_care')) {
    out.push({ id: `med-${r.id}`, area: 'medical', priority: 0, title: `See the crew medical officer about your ${REGION_LABEL[r.region].toLowerCase()}`,
      detail: 'No loading or exercises for that area until cleared.', because: [`Pain report ${new Date(r.ts).toLocaleDateString()}: ${r.result.reasons[0]}`], action: { tab: 'medical', label: 'Medical officer' } })
  }
  const actMetrics = Object.entries(st).filter(([, r]) => r.level === 'act').map(([id]) => id)
  if (actMetrics.length) out.push({ id: 'act-cmo', area: 'medical', priority: 1, title: 'Tell the crew medical officer about today’s Act results', detail: 'Repeat the daily check tomorrow morning.', because: actMetrics.map((id) => why(id, st[id])) })

  if (!s.sessions.some((x) => x.crewId === p.id && x.kind === 'daily' && dayKey(x.ts) === today))
    out.push({ id: 'check', area: 'check', priority: 2, title: 'Do today’s 2-minute check', detail: 'Face scan + mood & sleep keep your baseline accurate.', because: ['No daily check recorded today'], action: { tab: 'check', label: 'Start check' } })

  const fatigue = ['sleep_hours', 'sleep_quality', 'energy', 'perclos', 'blink_rate'].filter(bad)
  if (fatigue.length) out.push({ id: 'sleep', area: 'sleep', priority: 3, title: 'Protect sleep tonight', detail: 'Plan an 8.5 h sleep window, dim the sleep-station light an hour before, no caffeine late in the work day, and avoid safety-critical tasks while tired.', because: fatigue.map((id) => why(id, st[id])) })

  if (bad('face_width')) out.push({ id: 'fluid', area: 'fluid', priority: 4, title: 'Facial fullness is up — check fluids and CO₂', detail: 'Check the module CO₂ reading, keep sodium under your limit, stay on your fluid target. Any vision change is a danger sign.', because: [why('face_width', st.face_width)] })
  if (bad('hr_rest') || bad('resp_rate')) out.push({ id: 'cardio', area: 'recovery', priority: 3, title: 'Resting heart or breathing rate is off your usual', detail: 'Keep exercise light today and re-measure tomorrow. Chest pain or breathlessness → act now.', because: ['hr_rest', 'resp_rate'].filter(bad).map((id) => why(id, st[id])) })
  if (bad('body_mass')) out.push({ id: 'mass', area: 'nutrition', priority: 3, title: 'Body mass is below your usual — eat more', detail: 'Add about 300 kcal a day and hit your protein target; keep your resistive sessions.', because: [why('body_mass', st.body_mass)], action: { tab: 'plan', label: 'Food plan' } })

  const gravity = !PHASES[p.phase].microgravity
  const balanceToday = s.sessions.some((x) => x.crewId === p.id && x.kind === 'balance' && dayKey(x.ts) === today)
  if ((p.phase === 'landing' || p.phase === 'surface' || p.phase === 'return') && !balanceToday)
    out.push({ id: 'balance', area: 'balance', priority: 2, title: 'Balance test before walking unaided or an EVA', detail: 'Eyes-closed sway is compared with your pre-flight baseline.', because: [`Phase: ${PHASES[p.phase].label}`], action: { tab: 'balance', label: 'Balance test' } })
  if (bad('sway_ec') || bad('sway_tandem')) out.push({ id: 'balance-train', area: 'balance', priority: 3, title: 'Balance retraining', detail: 'Hold a rail: feet-together and tandem stands, 3 × 30 s, twice a day. Walk with a spotter.', because: ['sway_ec', 'sway_tandem'].filter(bad).map((id) => why(id, st[id])) })
  if (p.phase === 'preflight') {
    const n = history(s.sessions, p.id, 'sway_ec').filter((x) => x.ok).length
    if (n < 7) out.push({ id: 'bal-base', area: 'balance', priority: 4, title: `Record your balance baseline (${n}/7)`, detail: 'Pre-flight balance is the reference for landing day.', because: ['Pre-flight phase'], action: { tab: 'balance', label: 'Balance test' } })
  }
  for (const r of recentSym.filter((x) => x.result.level === 'self_care' && x.result.exercises_allowed))
    out.push({ id: `relief-${r.id}`, area: 'exercise', priority: 4, title: `Relief exercises for your ${REGION_LABEL[r.region].toLowerCase()}`, detail: 'Twice a day; stop if pain rises by 2 points.', because: [`Pain report ${new Date(r.ts).toLocaleDateString()}: ${r.kind} ${r.intensity}/10`], action: { tab: 'coach', label: 'Camera coach' } })
  void gravity
  return out.sort((a, b) => a.priority - b.priority)
}

/** Daily countermeasure plan by mission phase, adjusted for problems. */
export function exercisePlan(s: State, p: CrewProfile): { headline: string; items: PlanItem[]; notes: string[] } {
  const st = crewStatus(s, p.id)
  const today = dayKey(new Date())
  const done = (ex: string) => s.workouts.some((w) => w.crewId === p.id && w.exercise === ex && dayKey(w.ts) === today)
  const recent = s.symptoms.filter((x) => x.crewId === p.id && Date.now() - Date.parse(x.ts) < RECENT && x.result.level !== 'self_care')
  const blockedRegions = new Set<Region>(recent.map((x) => x.region))
  const legsBlocked = ['hip', 'thigh', 'knee', 'lower_leg', 'ankle_foot', 'lower_back'].some((r) => blockedRegions.has(r as Region))
  const tired = ['sleep_hours', 'energy'].some((id) => st[id]?.level === 'act')
  const notes: string[] = []
  if (tired) notes.push('Act-level fatigue today: reduce intensity by about a third and skip maximal lifts.')
  if (blockedRegions.size) notes.push(`No loading for: ${[...blockedRegions].map((r) => REGION_LABEL[r].toLowerCase()).join(', ')} (medical officer review pending).`)
  const skip = (yes: boolean) => (yes ? 'Skip — area under medical review' : undefined)
  const ph: Phase = p.phase
  const mg = microgravityDays(p)
  const items: Record<Phase, PlanItem[]> = {
    transit: [
      { id: 'ared', label: 'Resistive session on ARED', detail: 'Squat, deadlift, heel raise, bench press — 3 × 8–12 at planned load', minutes: 60, coach: 'squat', skip: skip(legsBlocked) },
      { id: 'aero', label: 'Aerobic: treadmill (harness) or cycle', detail: 'Intervals 4 × 4 min hard / 3 min easy, or 30 min steady', minutes: 40, skip: skip(legsBlocked) },
      { id: 'mob', label: 'Spine & hip mobility', detail: 'Fetal tuck, cat-cow, hip flexor stretch in foot loops', minutes: 10 },
      { id: 'shoulder', label: 'Shoulder range check', detail: 'Arm raises with the camera coach — tracks range over the mission', minutes: 5, coach: 'arm_raise' },
    ],
    preflight: [
      { id: 'strength', label: 'Strength training', detail: 'Squat, lunge, deadlift, calf raise — build reserve before flight', minutes: 50, coach: 'squat' },
      { id: 'aero', label: 'Aerobic base', detail: '30–40 min run, row or cycle', minutes: 35 },
      { id: 'balance', label: 'Balance practice + baseline test', detail: 'Feet together, eyes closed, tandem stance', minutes: 10 },
    ],
    landing: [
      { id: 'walk', label: 'Assisted walking', detail: 'Short walks with a spotter or rail; stop if dizzy', minutes: 15 },
      { id: 'balance', label: 'Balance retraining', detail: 'Supported stands, head turns slowly', minutes: 10 },
      { id: 'sts', label: 'Sit-to-stand practice', detail: '3 × 5 slow reps from a chair, with the coach', minutes: 10, coach: 'sit_to_stand', skip: skip(legsBlocked) },
    ],
    surface: [
      { id: 'walk', label: 'Walking / EVA-prep conditioning', detail: 'Partial gravity loads bones a little — use it daily', minutes: 30 },
      { id: 'strength', label: 'Resistive training', detail: 'Squats and lunges with the coach, 3 × 10', minutes: 40, coach: 'lunge', skip: skip(legsBlocked) },
      { id: 'balance', label: 'Balance drills', detail: 'Tandem stance, single-leg holds near a rail', minutes: 10 },
    ],
    return: [
      { id: 'rehab', label: 'Reconditioning with the flight surgeon’s plan', detail: 'Progressive walking, strength and balance', minutes: 45 },
      { id: 'sts', label: 'Sit-to-stand & squats', detail: 'Track depth and form with the coach', minutes: 15, coach: 'squat', skip: skip(legsBlocked) },
    ],
  }
  const list = items[ph].map((i) => ({ ...i, done: i.coach ? done(i.coach) : false }))
  const total = list.filter((i) => !i.skip).reduce((a, b) => a + b.minutes, 0)
  const headline = ph === 'transit'
    ? `Day ${mg} floating: about ${total} min of countermeasure exercise. Long-duration crews exercise ~2 h a day to protect bone and muscle.`
    : `${PHASES[ph].label}: about ${total} min today.`
  return { headline, items: list, notes }
}
