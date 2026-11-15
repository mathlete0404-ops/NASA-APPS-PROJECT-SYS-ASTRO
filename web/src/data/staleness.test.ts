import { describe, expect, it } from 'vitest'
import { crewStatus, type State } from './store'
import type { Measurement, Session } from './types'

// Local noon on 15 Nov 2026, and checks at 09:00 `ago` days before.
const NOW = new Date(2026, 10, 15, 12)
const at = (ago: number) => new Date(2026, 10, 15 - ago, 9).toISOString()
const m = (metric: string, value: number): Measurement => ({ metric, value, ok: true, quality: 1, unit: '', source: 'test' })
const check = (ago: number, withScan = true): Session => ({
  id: `c${ago}`, crewId: 'A', ts: at(ago), missionDay: 50 - ago, kind: 'daily',
  measurements: [...(withScan ? [m('hr_rest', 60 + (ago % 3))] : []), m('mood', 7), m('sleep_hours', 7)],
})
const state = (sessions: Session[]) => ({ sessions } as unknown as State)
const days = (n: number, from = 1) => Array.from({ length: n }, (_, i) => check(from + i))

describe('status never shows an old value as current', () => {
  it('a face measure is current when today’s check included the scan', () => {
    const st = crewStatus(state([...days(10), check(0)]), 'A', NOW)
    expect(st.hr_rest.level).not.toBe('nodata')
    expect(st.hr_rest.value).toBeDefined()
  })
  it('skipping the face scan today makes face measures No data, check-in answers stay current', () => {
    const st = crewStatus(state([...days(10), check(0, false)]), 'A', NOW)
    expect(st.hr_rest.level).toBe('nodata')
    expect(st.hr_rest.value).toBeUndefined()
    expect(st.hr_rest.reasons[0]).toMatch(/Not measured in your latest check/)
    expect(st.hr_rest.reasons[0]).toMatch(/Last good value/)
    expect(st.hr_rest.why).toBe('skipped')
    expect(st.mood.level).not.toBe('nodata')
  })
  it('after more than 2 days without a check, daily measures are No data', () => {
    const st = crewStatus(state(days(10, 4)), 'A', NOW) // last check 4 days ago
    expect(st.hr_rest.level).toBe('nodata')
    expect(st.mood.level).toBe('nodata')
    expect(st.mood.reasons[0]).toMatch(/4 days ago/)
    expect(st.mood.why).toBe('stale')
    expect(st.mood.ageDays).toBe(4)
  })
  it('a check yesterday is still current today', () => {
    const st = crewStatus(state(days(10, 1)), 'A', NOW)
    expect(st.hr_rest.level).not.toBe('nodata')
    expect(st.mood.level).not.toBe('nodata')
  })
})
