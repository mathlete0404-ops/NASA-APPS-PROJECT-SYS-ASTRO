import { describe, expect, it } from 'vitest'
import { fixtureCrewState } from './crewFixture.test-helper'
import { crewStatus, dropOldSample } from './store'
import { worst } from '../engine/status'

// End-to-end check of the status engine on a realistic history.
describe('crew status from stored history', () => {
  const d = fixtureCrewState()
  const state = { ...d, loaded: true, online: false, account: null, onboarded: true }
  const overall = Object.fromEntries(d.crew.map((c) => [c.id, worst(Object.values(crewStatus(state, c.id)).map((r) => r.level))]))
  it('covers Usual / Watch / Act / No data', () => {
    expect(overall).toEqual({ CDR: 'usual', PLT: 'act', MS1: 'watch', MS2: 'nodata' })
  })
})

// Older builds saved a made-up crew with `sample: true`. Loading it must not crash,
// must drop every made-up record, keep the astronaut's own records, and reopen setup.
describe('old saved state with sample: true', () => {
  const d = fixtureCrewState()
  const flag = <T,>(xs: T[]) => xs.map((x) => ({ ...x, synthetic: true }))
  const own = { id: 'abc123', crewId: 'MS3', ts: new Date().toISOString(), missionDay: 0, kind: 'daily' as const, measurements: [] }
  const saved = { ...d, sessions: [...flag(d.sessions), own], symptoms: flag(d.symptoms), onboarded: true, sample: true }
  const out = dropOldSample(saved)
  it('returns to the first-open setup with no made-up records', () => {
    expect(out.onboarded).toBe(false)
    expect(out.crew).toEqual([])
    expect(out.sessions).toEqual([own])
    expect(out.symptoms).toEqual([])
    expect(out.events).toEqual([])
    expect(out.workouts).toEqual([])
  })
  it('copes with missing fields', () => {
    expect(() => dropOldSample({ sample: true })).not.toThrow()
  })
})
