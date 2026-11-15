// Synthetic demo crew so judges can see Usual / Watch / Act / No data on first open.
// Clearly labelled synthetic; call signs only, no real people.
import type { CrewProfile, Measurement, Session, SymptomReport } from './types'
import type { State } from './store'
import { METRICS } from '../engine/status'
import { triage } from '../engine/triage'

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MISSION_DAY = 96
const iso = (d: Date) => d.toISOString().slice(0, 10)

export function demoState(): Omit<State, 'loaded' | 'online' | 'account' | 'onboarded' | 'sample'> {
  const today = new Date()
  const launch = new Date(today)
  launch.setDate(today.getDate() - MISSION_DAY)
  const crew: CrewProfile[] = [
    { id: 'CDR', role: 'Commander', launchDate: iso(launch), phase: 'transit', transitDays: 0 },
    { id: 'PLT', role: 'Pilot', launchDate: iso(launch), phase: 'transit', transitDays: 0 },
    { id: 'MS1', role: 'Mission specialist', launchDate: iso(launch), phase: 'transit', transitDays: 0 },
    { id: 'MS2', role: 'Mission specialist · crew medical officer', launchDate: iso(launch), phase: 'transit', transitDays: 0, isCmo: true },
  ]
  const sessions: Session[] = []
  const symptoms: SymptomReport[] = []
  const at = (day: number, hour: number) => {
    const d = new Date(launch)
    d.setDate(launch.getDate() + day)
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
  }
  const m = (metric: string, value: number | null, ok = true, quality = 0.8): Measurement => ({
    metric, value: value == null ? null : Math.round(value * 1000) / 1000, unit: METRICS[metric].unit,
    quality, ok, source: METRICS[metric].source,
  })

  crew.forEach((c, ci) => {
    const r = rng(42 + ci * 101)
    const n = (sd: number) => (r() + r() + r() - 1.5) * sd * 1.15
    const base = { hr: 60 + ci * 3, blink: 15 + ci, perclos: 4, fw: 2.28 + ci * 0.03, mood: 7, energy: 7, sleep: 7, sq: 7, mass: 72 + ci * 5 }

    // Pre-flight balance baseline (L-30 … L-24) — the reference for landing day.
    for (let k = 0; k < 7; k++)
      sessions.push({
        id: `${c.id}-bal-${k}`, crewId: c.id, ts: at(-30 + k, 10), missionDay: -30 + k, kind: 'balance', synthetic: true,
        measurements: [m('sway_eo', 1.2 + n(0.12)), m('sway_ec', 2.0 + n(0.2)), m('sway_tandem', 3.0 + n(0.3)), m('sts_time', 9.5 + n(0.4))],
      })
    // Body mass: 7 weekly pre-flight weigh-ins (baseline), then weekly in flight.
    // MS1 is slowly losing mass (eating below target) — a common in-flight pattern.
    for (let k = -49; k <= MISSION_DAY - 1; k += 7) {
      const loss = k <= 0 ? 0 : c.id === 'MS1' ? Math.min(k, 90) * 0.006 : 0.15
      sessions.push({
        id: `${c.id}-mass-${k}`, crewId: c.id, ts: at(k, 7), missionDay: k, kind: 'mass', synthetic: true,
        measurements: [m('body_mass', base.mass - loss + n(0.12))],
      })
    }
    // Daily check-ins: 14 days ending yesterday — first 7 form the baseline.
    for (let d = MISSION_DAY - 14; d < MISSION_DAY; d++) {
      const late = d - (MISSION_DAY - 14) // 0..13
      let { hr, blink, perclos, fw, mood, energy, sleep, sq } = base
      let resp = 13 + ci * 0.5 + n(0.8)
      hr += n(1.3); blink += n(1.5); perclos += n(0.6); fw += n(0.006)
      mood += n(0.5); energy += n(0.5); sleep += n(0.3); sq += n(0.5)
      let hrOk = true
      if (c.id === 'PLT' && late >= 10) { // fatigue building: short sleep, eyes closing
        const k = late - 9
        sleep = 7 - 0.6 * k; sq = 7 - 0.9 * k; perclos = 4 + 1.6 * k; energy = 7 - 1.0 * k; blink += 1.5 * k
      }
      if (c.id === 'MS1' && late >= 12) fw = base.fw + 0.035 // facial fullness rising
      if (c.id === 'MS2' && late === 13) hrOk = false // bad light this morning
      sessions.push({
        id: `${c.id}-day-${d}`, crewId: c.id, ts: at(d, 8), missionDay: d, kind: 'daily', synthetic: true,
        measurements: [
          m('hr_rest', hrOk ? hr : null, hrOk, hrOk ? 0.6 : 0.12), m('resp_rate', hrOk ? Math.round(resp) : null, hrOk, hrOk ? 0.5 : 0.1), m('blink_rate', blink), m('perclos', perclos),
          m('face_width', fw), m('mood', Math.round(mood)), m('energy', Math.round(energy)),
          m('sleep_hours', Math.round(sleep * 4) / 4), m('sleep_quality', Math.round(sq)),
        ],
      })
    }
  })

  const symptomInput = {
    danger: {}, region: 'lower_back' as const, kind: 'pain' as const, intensity: 4, onset: 'gradual' as const,
    tests: { stretch_pain: true, muscle_tender: true }, microgravity_days: MISSION_DAY - 2,
  }
  symptoms.push({
    id: 'MS2-sym-1', crewId: 'MS2', ts: at(MISSION_DAY - 2, 21), region: 'lower_back', side: 'middle', kind: 'pain',
    intensity: 4, onset: 'gradual', context: ['sleep'], danger: {}, tests: symptomInput.tests,
    microgravityDays: MISSION_DAY - 2, result: triage(symptomInput), synthetic: true,
  })
  const day = (n: number) => { const d = new Date(launch); d.setDate(launch.getDate() + n); return iso(d) }
  const events = [
    { id: 'ev-launch', crewId: 'ALL', date: iso(launch), kind: 'other' as const, title: 'Launch' },
    { id: 'ev-eva1', crewId: 'MS2', date: day(MISSION_DAY - 3), kind: 'eva' as const, title: 'EVA 1 (6 h 40 min)' },
    { id: 'ev-eva2', crewId: 'PLT', date: day(MISSION_DAY + 4), kind: 'eva' as const, title: 'EVA 2 planned' },
    { id: 'ev-med', crewId: 'ALL', date: day(MISSION_DAY + 2), kind: 'medical' as const, title: 'Weekly private medical conference' },
    { id: 'ev-land', crewId: 'ALL', date: day(MISSION_DAY + 120), kind: 'landing' as const, title: 'Mars orbit insertion' },
  ]
  const workouts = crew.flatMap((c, ci) => [3, 2, 1].map((ago) => ({
    id: `${c.id}-wo-${ago}`, crewId: c.id, ts: at(MISSION_DAY - ago, 17), exercise: 'squat', reps: 10, formScore: [90, 80, 100, 70][ci],
    faults: (ci === 3 ? { valgus: 3 } : {}) as Record<string, number>, bestAngle: 96 + ci * 3, source: 'coach' as const,
  })))
  return { crew, activeCrew: 'PLT', sessions, symptoms, downlink: [], events, workouts, food: [] }
}
