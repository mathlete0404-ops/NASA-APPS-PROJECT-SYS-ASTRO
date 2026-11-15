// Who in the crew may be in danger right now. Deterministic rules on data already in the app:
// a danger sign reported in "Something hurts", or a measure at "Act" level, in the last 24 hours.
// Pure: no store, no DOM; the clock and status function are passed in.
import type { SymptomReport } from '../data/types'
import type { DangerAnswers } from './triage'
import type { StatusResult } from './status'
import { METRICS } from './status'
import type { GuideId } from '../content/emergency'

export interface CrewAlert {
  crewId: string
  ts: string
  reason: string
  /** The guide that fits best, if any. */
  guide?: GuideId
  source: 'danger-sign' | 'measure'
}

export const ALERT_HOURS = 24

const DANGER_GUIDE: Record<keyof DangerAnswers, GuideId | undefined> = {
  chest_pain: 'chest',
  one_sided_weakness: 'stroke',
  severe_headache_vision: 'stroke',
  back_pain_leg_numb_bladder: undefined,
  fall_impact: 'head',
}
const DANGER_SHORT: Record<keyof DangerAnswers, string> = {
  chest_pain: 'chest pain',
  one_sided_weakness: 'one-sided weakness or slurred speech',
  severe_headache_vision: 'sudden severe headache or vision change',
  back_pain_leg_numb_bladder: 'back pain with leg numbness',
  fall_impact: 'pain after a fall or impact',
}
/** Most dangerous first, so the alert names the worst sign. */
const DANGER_ORDER: (keyof DangerAnswers)[] = ['chest_pain', 'one_sided_weakness', 'severe_headache_vision', 'fall_impact', 'back_pain_leg_numb_bladder']

export function crewAlerts(
  crewIds: string[],
  symptoms: readonly Pick<SymptomReport, 'crewId' | 'ts' | 'danger' | 'result'>[],
  statusOf: (crewId: string) => Record<string, StatusResult>,
  lastMeasured: (crewId: string, metric: string) => string | undefined,
  now: Date = new Date(),
): CrewAlert[] {
  const since = now.getTime() - ALERT_HOURS * 3600e3
  const out: CrewAlert[] = []
  for (const id of crewIds) {
    // 1. danger signs reported in the last 24 h (newest first)
    const recent = symptoms.filter((x) => x.crewId === id && Date.parse(x.ts) >= since && x.result?.level === 'act_now')
      .sort((a, b) => b.ts.localeCompare(a.ts))
    const sym = recent[0]
    if (sym) {
      const key = DANGER_ORDER.find((k) => sym.danger?.[k])
      out.push({ crewId: id, ts: sym.ts, source: 'danger-sign', guide: key ? DANGER_GUIDE[key] : undefined,
        reason: key ? `Danger sign: ${DANGER_SHORT[key]}` : 'Urgent pattern reported' })
      continue
    }
    // 2. a measure far outside their own normal (Act), measured in the last 24 h
    const st = statusOf(id)
    const act = Object.entries(st).filter(([m, r]) => r.level === 'act' && Date.parse(lastMeasured(id, m) ?? '') >= since)
    if (act.length) {
      const [m] = act[0]
      out.push({ crewId: id, ts: lastMeasured(id, m)!, source: 'measure', guide: m === 'hr_rest' ? 'chest' : undefined,
        reason: `${METRICS[m]?.label ?? m} far outside their usual` })
    }
  }
  return out.sort((a, b) => b.ts.localeCompare(a.ts))
}

/** An alert stays until someone presses “Help is on the way” after it was raised. */
export const openAlerts = (alerts: CrewAlert[], ackedAt: Record<string, string>) =>
  alerts.filter((a) => !ackedAt[a.crewId] || ackedAt[a.crewId] < a.ts)
