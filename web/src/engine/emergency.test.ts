import { describe, expect, it } from 'vitest'
import { crewAlerts, openAlerts } from './emergency'
import { GUIDES, GUIDE, TRIAGE_QUESTIONS } from '../content/emergency'
import type { StatusResult } from './status'

const NOW = new Date(2026, 10, 15, 12)
const ago = (h: number) => new Date(NOW.getTime() - h * 3600e3).toISOString()
const sym = (crewId: string, h: number, danger: Record<string, boolean>, level = 'act_now') =>
  ({ crewId, ts: ago(h), danger, result: { level, pattern: 'danger_sign', reasons: [], exercises_allowed: false, bone_loss_est_pct: 0 } }) as never
const none = () => ({} as Record<string, StatusResult>)

describe('crew danger alerts', () => {
  it('a danger sign in the last 24 h raises an alert with the matching guide', () => {
    const a = crewAlerts(['A', 'B'], [sym('A', 1, { chest_pain: true })], none, () => undefined, NOW)
    expect(a).toHaveLength(1)
    expect(a[0]).toMatchObject({ crewId: 'A', guide: 'chest', source: 'danger-sign' })
    expect(a[0].reason).toMatch(/chest pain/)
  })
  it('names the most dangerous sign first', () => {
    const a = crewAlerts(['A'], [sym('A', 1, { fall_impact: true, one_sided_weakness: true })], none, () => undefined, NOW)
    expect(a[0].guide).toBe('stroke')
  })
  it('older than 24 h, or not urgent: no alert', () => {
    expect(crewAlerts(['A'], [sym('A', 30, { chest_pain: true })], none, () => undefined, NOW)).toHaveLength(0)
    expect(crewAlerts(['A'], [sym('A', 1, {}, 'self_care')], none, () => undefined, NOW)).toHaveLength(0)
  })
  it('a measure at Act level in the last 24 h raises an alert; an old one does not', () => {
    const st = () => ({ hr_rest: { level: 'act', reasons: [] } as StatusResult })
    expect(crewAlerts(['A'], [], st, () => ago(2), NOW)[0]).toMatchObject({ source: 'measure', guide: 'chest' })
    expect(crewAlerts(['A'], [], st, () => ago(40), NOW)).toHaveLength(0)
  })
  it('stays until someone presses “Help is on the way” after it was raised', () => {
    const a = crewAlerts(['A'], [sym('A', 1, { chest_pain: true })], none, () => undefined, NOW)
    expect(openAlerts(a, {})).toHaveLength(1)
    expect(openAlerts(a, { A: ago(0) })).toHaveLength(0)
    expect(openAlerts(a, { A: ago(5) })).toHaveLength(1) // acknowledged before this alert: still open
  })
})

describe('emergency guides', () => {
  it('every guide has steps, ends by sending the log to Earth, and cites a source', () => {
    for (const g of GUIDES) {
      expect(g.steps.length).toBeGreaterThan(3)
      expect(g.steps[g.steps.length - 1].title).toMatch(/Send the log to Earth/)
      expect(g.sources.length).toBeGreaterThan(0)
    }
  })
  it('CPR has a compression beat; the quick questions cover every guide, most dangerous first', () => {
    expect(GUIDE.cpr.steps.some((s) => s.kind === 'timer' && s.cpr)).toBe(true)
    expect(TRIAGE_QUESTIONS[0].guide).toBe('cpr')
    expect(new Set(TRIAGE_QUESTIONS.map((q) => q.guide)).size).toBe(GUIDES.length)
  })
})
