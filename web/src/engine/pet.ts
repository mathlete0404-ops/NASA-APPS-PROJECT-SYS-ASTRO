// Crew pet: a small companion that grows when the astronaut shows up.
//
// Design rules (do not change without a team decision):
// - Growth comes from showing up (daily check, exercise, food log, pain report),
//   never from health results. A bad result must never make the pet sad, or crew
//   learn to hide symptoms.
// - Reporting pain counts as care, so honesty is rewarded.
// - Missing days makes it "sleepy", never sick. No lost progress, no guilt.
// - Like a Tamagotchi it has needs (fed, exercised, checked in) that run down over hours and are
//   refilled only by care. Empty needs make it hungry or sleepy, never ill, and it never dies.
// - The egg incubates: it hatches after HATCH_DAYS daily checks (the crew member taps it open).
// Pure logic: no store, no DOM, no clock unless passed in.
import type { FoodEntry, Session, SymptomReport, Workout } from '../data/types'

/** Local calendar day YYYY-MM-DD (same as dayKey in data/store). */
export const localDay = (ts: string | Date): string => {
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The local day before a YYYY-MM-DD key. */
const prevDay = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number)
  return localDay(new Date(y, m - 1, d - 1))
}

export type StageId = 'egg' | 'hatchling' | 'cadet' | 'explorer' | 'veteran'
export interface Stage { id: StageId; name: string; min: number; note: string }

/** Stages by number of days with a daily check. Cadet = the day your baseline is learned. */
export const HATCH_DAYS = 3
export const STAGES: readonly Stage[] = [
  { id: 'egg', name: 'Egg', min: 0, note: `Keep it warm: it hatches after ${HATCH_DAYS} daily checks.` },
  { id: 'hatchling', name: 'Hatchling', min: HATCH_DAYS, note: 'Hatched after three check-ins. Small, curious, new to space.' },
  { id: 'cadet', name: 'Cadet', min: 7, note: 'Seven checks: the app now knows your normal.' },
  { id: 'explorer', name: 'Explorer', min: 21, note: 'Three weeks of check-ins. Ready for longer trips.' },
  { id: 'veteran', name: 'Veteran', min: 60, note: 'Sixty check days. A long-haul crew member.' },
]

export type Mood = 'thriving' | 'happy' | 'content' | 'waiting' | 'sleepy'
export const MOOD_LABEL: Record<Mood, string> = {
  thriving: 'Thriving',
  happy: 'Happy',
  content: 'Content',
  waiting: 'Waiting for you',
  sleepy: 'Sleepy',
}

export type TaskId = 'check' | 'move' | 'eat'
export interface PetTask {
  id: TaskId
  label: string
  tab: string
  done: boolean
  /** Set when the exercise task was covered by a pain report instead (care, not a skip). */
  byPainReport?: boolean
}

export interface PetInput {
  sessions: readonly Pick<Session, 'crewId' | 'ts' | 'kind'>[]
  workouts: readonly Pick<Workout, 'crewId' | 'ts'>[]
  food: readonly Pick<FoodEntry, 'crewId' | 'ts'>[]
  symptoms: readonly Pick<SymptomReport, 'crewId' | 'ts'>[]
}

export type NeedId = 'fed' | 'fit' | 'cared'
export interface Need { id: NeedId; label: string; level: number; tab: string; hungry: string }
/** Hours a need stays full, and hours until it is empty. */
const NEED_CURVE: Record<NeedId, [number, number]> = { fed: [8, 30], fit: [24, 72], cared: [24, 60] }
const needLevel = (id: NeedId, last: number | null, now: number) => {
  if (last == null) return 0
  const h = (now - last) / 3.6e6
  const [full, empty] = NEED_CURVE[id]
  return h <= full ? 100 : Math.max(0, Math.round(100 * (1 - (h - full) / (empty - full))))
}

export interface PetState {
  stage: Stage
  next: Stage | null
  checkDays: number
  /** 0..1 towards the next stage (1 at the last stage). */
  progress: number
  streak: number
  bestStreak: number
  xp: number
  mood: Mood
  tasks: PetTask[]
  /** Tamagotchi needs, 0..100, run down over hours and refilled by care. */
  needs: Need[]
  /** Egg: share of incubation done (check days / HATCH_DAYS), 1 = ready to hatch. */
  incubation: number
}

export const XP = { check: 10, move: 5, eat: 3, pain: 5 } as const

const daysOf = (xs: readonly { crewId: string; ts: string }[], crewId: string) =>
  new Set(xs.filter((x) => x.crewId === crewId).map((x) => localDay(x.ts)))

export function petState(input: PetInput, crewId: string, now: Date = new Date()): PetState {
  const check = daysOf(input.sessions.filter((x) => x.kind === 'daily'), crewId)
  const move = daysOf(input.workouts, crewId)
  const eat = daysOf(input.food, crewId)
  const pain = daysOf(input.symptoms, crewId)

  const today = localDay(now)
  const yesterday = prevDay(today)

  // Stage
  const checkDays = check.size
  let i = 0
  while (i + 1 < STAGES.length && checkDays >= STAGES[i + 1].min) i++
  const stage = STAGES[i]
  const next = STAGES[i + 1] ?? null
  const progress = next ? Math.min(1, Math.max(0, (checkDays - stage.min) / (next.min - stage.min))) : 1

  // Streak: ends today, or yesterday while today's check isn't done yet.
  let streak = 0
  for (let d = check.has(today) ? today : yesterday; check.has(d); d = prevDay(d)) streak++

  let bestStreak = 0
  let run = 0
  let last = ''
  for (const d of [...check].sort()) {
    run = last && prevDay(d) === last ? run + 1 : 1
    bestStreak = Math.max(bestStreak, run)
    last = d
  }

  const xp = XP.check * check.size + XP.move * move.size + XP.eat * eat.size + XP.pain * pain.size

  // A pain report covers today's exercise: someone in pain should not be nudged to work out.
  const painToday = pain.has(today)
  const tasks: PetTask[] = [
    { id: 'check', label: 'Daily check', tab: 'check', done: check.has(today) },
    { id: 'move', label: 'Exercise', tab: 'plan', done: move.has(today) || painToday, ...(!move.has(today) && painToday ? { byPainReport: true } : {}) },
    { id: 'eat', label: 'Log food', tab: 'plan', done: eat.has(today) },
  ]

  const done = tasks.filter((t) => t.done).length
  const mood: Mood =
    done >= 3 ? 'thriving'
      : done === 2 ? 'happy'
        : done === 1 ? 'content'
          : checkDays === 0 || check.has(yesterday) ? 'waiting'
            : 'sleepy'

  const lastOf = (xs: readonly { crewId: string; ts: string }[]) => {
    let m: number | null = null
    for (const x of xs) if (x.crewId === crewId) { const v = Date.parse(x.ts); if (m == null || v > m) m = v }
    return m
  }
  const t = now.getTime()
  const lastMove = Math.max(lastOf(input.workouts) ?? -Infinity, lastOf(input.symptoms) ?? -Infinity) // a pain report counts as care
  const needs: Need[] = [
    { id: 'fed', label: 'Fed', level: needLevel('fed', lastOf(input.food), t), tab: 'plan', hungry: 'Hungry: log a meal' },
    { id: 'fit', label: 'Exercised', level: needLevel('fit', Number.isFinite(lastMove) ? lastMove : null, t), tab: 'plan', hungry: 'Restless: do today’s exercise' },
    { id: 'cared', label: 'Checked in', level: needLevel('cared', lastOf(input.sessions.filter((x) => x.kind === 'daily')), t), tab: 'check', hungry: 'Lonely: do your daily check' },
  ]
  const incubation = Math.min(1, checkDays / HATCH_DAYS)

  return { stage, next, checkDays, progress, streak, bestStreak, xp, mood, tasks, needs, incubation }
}
