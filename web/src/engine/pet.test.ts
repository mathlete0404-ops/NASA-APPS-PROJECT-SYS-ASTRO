import { describe, expect, it } from 'vitest'
import type { FoodEntry, Measurement, Session, SymptomReport, Workout } from '../data/types'
import { localDay, petState, type PetInput } from './pet'

// Fixed local "now": Sun 15 Nov 2026, 10:00 local time.
const NOW = new Date(2026, 10, 15, 10, 0, 0)
/** ISO timestamp for local 09:00, `ago` days before NOW. */
const at = (ago: number, hour = 9) => new Date(2026, 10, 15 - ago, hour, 0, 0).toISOString()

const m = (value: number | null, ok = true): Measurement => ({ metric: 'hr', value, unit: 'bpm', quality: ok ? 0.9 : 0.1, ok, source: 'test' })
const session = (ago: number, crewId = 'ALPHA', kind: Session['kind'] = 'daily', ms: Measurement[] = [m(62)]): Session =>
  ({ id: `${crewId}-${kind}-${ago}`, crewId, ts: at(ago), missionDay: 100 - ago, kind, measurements: ms })
const workout = (ago: number, crewId = 'ALPHA', formScore = 90): Workout =>
  ({ id: `w-${crewId}-${ago}`, crewId, ts: at(ago, 12), exercise: 'squat', reps: 10, formScore, faults: {}, source: 'coach' })
const food = (ago: number, crewId = 'ALPHA'): FoodEntry => ({ id: `f-${crewId}-${ago}`, crewId, ts: at(ago, 13), itemId: 'oats', servings: 1 })
const pain = (ago: number, crewId = 'ALPHA', intensity = 3) =>
  ({ id: `p-${crewId}-${ago}`, crewId, ts: at(ago, 15), intensity }) as unknown as SymptomReport

const input = (p: Partial<PetInput>): PetInput => ({ sessions: [], workouts: [], food: [], symptoms: [], ...p })
/** Daily checks on each of the given "days ago". */
const checks = (agos: number[], crewId = 'ALPHA') => agos.map((a) => session(a, crewId))
const range = (n: number, from = 0) => Array.from({ length: n }, (_, i) => from + i)

describe('pet stages', () => {
  const cases: [number, string, string | null][] = [
    [0, 'egg', 'hatchling'],
    [1, 'egg', 'hatchling'],
    [2, 'egg', 'hatchling'],
    [3, 'hatchling', 'cadet'],
    [6, 'hatchling', 'cadet'],
    [7, 'cadet', 'explorer'],
    [20, 'cadet', 'explorer'],
    [21, 'explorer', 'veteran'],
    [59, 'explorer', 'veteran'],
    [60, 'veteran', null],
    [90, 'veteran', null],
  ]
  for (const [n, stage, next] of cases) {
    it(`${n} check days -> ${stage}`, () => {
      const p = petState(input({ sessions: checks(range(n)) }), 'ALPHA', NOW)
      expect(p.checkDays).toBe(n)
      expect(p.stage.id).toBe(stage)
      expect(p.next?.id ?? null).toBe(next)
    })
  }

  it('progress runs 0..1 inside a stage', () => {
    expect(petState(input({}), 'ALPHA', NOW).progress).toBe(0)
    expect(petState(input({ sessions: checks(range(5)) }), 'ALPHA', NOW).progress).toBeCloseTo(2 / 4)
    expect(petState(input({ sessions: checks(range(60)) }), 'ALPHA', NOW).progress).toBe(1)
  })

  it('several checks on one day count once, other session kinds do not count', () => {
    const p = petState(input({ sessions: [session(0), { ...session(0), id: 'again' }, session(1, 'ALPHA', 'balance'), session(2, 'ALPHA', 'mass')] }), 'ALPHA', NOW)
    expect(p.checkDays).toBe(1)
  })
})

describe('pet streak', () => {
  it('counts back from today and stops at a gap', () => {
    // today, 1, 2 done; 3 missed; 4..8 done
    const p = petState(input({ sessions: checks([0, 1, 2, 4, 5, 6, 7, 8]) }), 'ALPHA', NOW)
    expect(p.streak).toBe(3)
    expect(p.bestStreak).toBe(5)
  })

  it('keeps the streak while today is not done yet', () => {
    const p = petState(input({ sessions: checks([1, 2, 3, 4]) }), 'ALPHA', NOW)
    expect(p.streak).toBe(4)
    expect(p.tasks.find((t) => t.id === 'check')?.done).toBe(false)
  })

  it('is 0 after a missed day, but nothing else is lost', () => {
    const p = petState(input({ sessions: checks([2, 3, 4, 5, 6, 7, 8]) }), 'ALPHA', NOW)
    expect(p.streak).toBe(0)
    expect(p.bestStreak).toBe(7)
    expect(p.stage.id).toBe('cadet')
    expect(p.xp).toBe(70)
  })

  it('crosses month boundaries', () => {
    const p = petState(input({ sessions: checks(range(20)) }), 'ALPHA', NOW) // back into October
    expect(p.streak).toBe(20)
  })
})

describe('pet mood and tasks', () => {
  it('3 tasks -> thriving, 2 -> happy, 1 -> content', () => {
    expect(petState(input({ sessions: checks([0]), workouts: [workout(0)], food: [food(0)] }), 'ALPHA', NOW).mood).toBe('thriving')
    expect(petState(input({ sessions: checks([0]), food: [food(0)] }), 'ALPHA', NOW).mood).toBe('happy')
    expect(petState(input({ food: [food(0)] }), 'ALPHA', NOW).mood).toBe('content')
  })

  it('0 tasks -> waiting if never checked or checked yesterday', () => {
    expect(petState(input({}), 'ALPHA', NOW).mood).toBe('waiting')
    expect(petState(input({ sessions: checks([1]) }), 'ALPHA', NOW).mood).toBe('waiting')
  })

  it('0 tasks after a missed day -> sleepy (never sick)', () => {
    const p = petState(input({ sessions: checks([2, 3]) }), 'ALPHA', NOW)
    expect(p.mood).toBe('sleepy')
  })

  it('tasks link to the right screens', () => {
    const p = petState(input({}), 'ALPHA', NOW)
    expect(p.tasks.map((t) => [t.id, t.tab, t.done])).toEqual([['check', 'check', false], ['move', 'plan', false], ['eat', 'plan', false]])
  })

  it('a pain report counts as care: covers exercise and earns XP', () => {
    const p = petState(input({ sessions: checks([0]), symptoms: [pain(0)] }), 'ALPHA', NOW)
    const move = p.tasks.find((t) => t.id === 'move')
    expect(move?.done).toBe(true)
    expect(move?.byPainReport).toBe(true)
    expect(p.mood).toBe('happy')
    expect(p.xp).toBe(10 + 5)
  })
})

describe('pet XP', () => {
  it('10 per check day, 5 per exercise day, 3 per food day, 5 per pain-report day', () => {
    const p = petState(input({
      sessions: checks([0, 1, 1]),
      workouts: [workout(0), workout(0), workout(3)],
      food: [food(0), food(0), food(2)],
      symptoms: [pain(5)],
    }), 'ALPHA', NOW)
    expect(p.xp).toBe(2 * 10 + 2 * 5 + 2 * 3 + 1 * 5)
  })
})

describe('pet isolation and fairness', () => {
  it("ignores other crew members' data", () => {
    const other = input({ sessions: checks(range(30), 'BRAVO'), workouts: [workout(0, 'BRAVO')], food: [food(0, 'BRAVO')], symptoms: [pain(0, 'BRAVO')] })
    const mine = petState(other, 'ALPHA', NOW)
    expect(mine).toEqual(petState(input({}), 'ALPHA', NOW))
    expect(mine.stage.id).toBe('egg')
    expect(mine.xp).toBe(0)
  })

  it('health values never change the pet', () => {
    const days = [0, 1, 2, 4, 5, 6, 7, 8, 9]
    const good = input({
      sessions: days.map((a) => session(a, 'ALPHA', 'daily', [m(60), { ...m(95), metric: 'fatigue' }])),
      workouts: [workout(0, 'ALPHA', 100), workout(4, 'ALPHA', 100)],
      food: [food(0), food(2)],
      symptoms: [pain(1, 'ALPHA', 1)],
    })
    const bad = input({
      sessions: days.map((a) => session(a, 'ALPHA', 'daily', [m(140), { ...m(5), metric: 'fatigue' }, m(null, false)])),
      workouts: [workout(0, 'ALPHA', 10), workout(4, 'ALPHA', 0)],
      food: [food(0), food(2)],
      symptoms: [pain(1, 'ALPHA', 9)],
    })
    expect(petState(bad, 'ALPHA', NOW)).toEqual(petState(good, 'ALPHA', NOW))
  })
})

describe('localDay', () => {
  it('uses the local calendar day', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localDay(new Date(2026, 0, 6, 0, 1).toISOString())).toBe('2026-01-06')
  })
})

describe('pet incubation and needs (Tamagotchi care)', () => {
  it('the egg incubates over three daily checks', () => {
    expect(petState(input({}), 'ALPHA', NOW).incubation).toBe(0)
    expect(petState(input({ sessions: checks([0]) }), 'ALPHA', NOW).incubation).toBeCloseTo(1 / 3)
    expect(petState(input({ sessions: checks([0, 1, 2]) }), 'ALPHA', NOW).incubation).toBe(1)
  })
  it('needs are full right after care and run down with time', () => {
    const fresh = petState(input({ sessions: checks([0]), food: [food(0)], workouts: [workout(0)] }), 'ALPHA', new Date(2026, 10, 15, 14))
    expect(fresh.needs.map((n) => n.level)).toEqual([100, 100, 100])
    const later = petState(input({ sessions: checks([2]), food: [food(1)], workouts: [workout(4)] }), 'ALPHA', NOW)
    const lv = Object.fromEntries(later.needs.map((n) => [n.id, n.level]))
    expect(lv.fed).toBeLessThan(100)
    expect(lv.fit).toBe(0)
    expect(lv.cared).toBeLessThan(100)
  })
  it('never cared for: all needs empty, but it is only sleepy or waiting, never sick', () => {
    const p = petState(input({}), 'ALPHA', NOW)
    expect(p.needs.every((n) => n.level === 0)).toBe(true)
    expect(['waiting', 'sleepy']).toContain(p.mood)
  })
  it('a pain report counts as exercise care', () => {
    const p = petState(input({ symptoms: [pain(0)] }), 'ALPHA', NOW)
    expect(p.needs.find((n) => n.id === 'fit')!.level).toBe(100)
  })
  it('needs ignore other crew members', () => {
    const p = petState(input({ food: [food(0, 'BRAVO')] }), 'ALPHA', NOW)
    expect(p.needs.find((n) => n.id === 'fed')!.level).toBe(0)
  })
})
