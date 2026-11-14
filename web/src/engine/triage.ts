// Deterministic symptom triage. Port of server/app/engine.py — both are tested against
// shared/triage_cases.json. Wording is "pattern", never "diagnosis".

export type Region =
  | 'head' | 'neck' | 'shoulder' | 'upper_back' | 'lower_back' | 'trunk_front' | 'arm'
  | 'hip' | 'thigh' | 'knee' | 'lower_leg' | 'ankle_foot' | 'other'
export type Kind = 'pain' | 'weakness' | 'numbness' | 'stiffness'
export type TriageLevel = 'act_now' | 'cmo' | 'self_care'
export type Pattern =
  | 'danger_sign' | 'nerve' | 'weakness' | 'possible_fracture' | 'severe_pain' | 'headache_fluid_shift' | 'trunk_front'
  | 'muscle_strain' | 'tendon_irritation' | 'tightness' | 'joint_irritation' | 'nonspecific'

export interface DangerAnswers {
  chest_pain?: boolean
  one_sided_weakness?: boolean
  severe_headache_vision?: boolean
  back_pain_leg_numb_bladder?: boolean
  fall_impact?: boolean
}
export interface TestAnswers {
  bony_tender?: boolean
  muscle_tender?: boolean
  resisted_pain?: boolean
  stretch_pain?: boolean
  rom_pain_angle?: number | null
  cannot_bear_weight?: boolean
  swelling?: boolean
  spreading_tingling?: boolean
}
export interface TriageInput {
  danger: DangerAnswers
  region: Region
  kind: Kind
  intensity: number
  onset: 'sudden' | 'gradual'
  tests: TestAnswers
  microgravity_days: number
}
export interface TriageResult {
  level: TriageLevel
  pattern: Pattern
  reasons: string[]
  exercises_allowed: boolean
  bone_loss_est_pct: number
}

export const DANGER_LABELS: Record<keyof DangerAnswers, string> = {
  chest_pain: 'Chest pain',
  one_sided_weakness: 'Sudden one-sided weakness or numbness, face drooping, or slurred speech',
  severe_headache_vision: 'Sudden severe headache or vision change',
  back_pain_leg_numb_bladder: 'Back pain with leg numbness or bladder/bowel change',
  fall_impact: 'Pain after a fall or impact',
}
export const WEIGHT_BEARING = new Set<Region>(['lower_back', 'hip', 'thigh', 'knee', 'lower_leg', 'ankle_foot'])
export const BONE_LOSS_PER_MONTH = 1.0
export const BASE_REFER_INTENSITY = 8
export const MIN_REFER_INTENSITY = 5

const r1 = (x: number) => Math.round(x * 10) / 10

export function boneLossEstimate(microgravityDays: number): number {
  return r1(Math.min((Math.max(microgravityDays, 0) / 30) * BONE_LOSS_PER_MONTH, 15))
}

export function referIntensity(region: Region, microgravityDays: number): number {
  if (!WEIGHT_BEARING.has(region)) return BASE_REFER_INTENSITY
  return Math.max(MIN_REFER_INTENSITY, BASE_REFER_INTENSITY - Math.floor(boneLossEstimate(microgravityDays) / 2))
}

export function triage(inp: TriageInput): TriageResult {
  const danger = inp.danger ?? {}
  const tests = inp.tests ?? {}
  const days = inp.microgravity_days ?? 0
  const bone = boneLossEstimate(days)
  const out = (level: TriageLevel, pattern: Pattern, reasons: string[], ex: boolean): TriageResult => ({
    level, pattern, reasons, exercises_allowed: ex, bone_loss_est_pct: bone,
  })

  const yes = (Object.keys(DANGER_LABELS) as (keyof DangerAnswers)[]).filter((k) => danger[k])
  if (yes.length) return out('act_now', 'danger_sign', yes.map((k) => `Danger sign: ${DANGER_LABELS[k]}.`), false)

  if (inp.region === 'trunk_front')
    return out('cmo', 'trunk_front', ['Chest or abdominal pain is not assessed by self-tests in this app: the crew medical officer checks it.'], false)

  if (inp.kind === 'numbness' || tests.spreading_tingling)
    return out('cmo', 'nerve', ['Numbness or spreading tingling suggests a nerve pattern.'], false)

  if (inp.kind === 'weakness')
    return out('cmo', 'weakness', ['New weakness needs a check by the crew medical officer.'], false)

  const flags: string[] = []
  if (tests.bony_tender) flags.push('Sharp pain on one bony spot')
  if (tests.cannot_bear_weight) flags.push('Cannot bear weight')
  if (tests.swelling) flags.push('Swelling')
  if (flags.length) {
    const reasons = [...flags.map((f) => `${f}.`), 'Possible-fracture pattern: STOP, no exercises.']
    if (WEIGHT_BEARING.has(inp.region) && bone >= 3)
      reasons.push(`Estimated weight-bearing bone loss ≈ ${bone}% after ${days} days in microgravity.`)
    return out('cmo', 'possible_fracture', reasons, false)
  }

  const limit = referIntensity(inp.region, days)
  if (inp.intensity >= limit) {
    const reasons = [`Pain ${inp.intensity}/10 is at or above the referral level ${limit}/10.`]
    if (limit < BASE_REFER_INTENSITY)
      reasons.push(
        `Referral level lowered from ${BASE_REFER_INTENSITY} to ${limit} because estimated weight-bearing bone loss is ≈ ${bone}% (${days} days × ~1%/month).`,
      )
    return out('cmo', 'severe_pain', reasons, false)
  }

  if (inp.region === 'head')
    return out('self_care', 'headache_fluid_shift',
      ['Gradual headache with no danger signs: check cabin CO₂, fluids and sleep first.'], false)

  const found: [Pattern, string][] = []
  if (tests.muscle_tender) found.push(['muscle_strain', 'Pressing the muscle belly hurts → muscle strain / inflammation pattern.'])
  if (tests.resisted_pain) found.push(['tendon_irritation', 'Pain when tightening against resistance → muscle/tendon irritation pattern.'])
  if (tests.stretch_pain) found.push(['tightness', 'Pain on stretch → tightness / strain pattern.'])
  if (tests.rom_pain_angle != null)
    found.push(['joint_irritation', `Pain starts at ${tests.rom_pain_angle}° in the range test → joint irritation pattern.`])
  if (!found.length)
    return out('self_care', 'nonspecific', ['No test reproduced the pain → non-specific / deconditioning pattern.'], true)
  return out('self_care', found[0][0], found.map(([, r]) => r), true)
}

export const PATTERN_LABEL: Record<Pattern, string> = {
  danger_sign: 'Danger sign',
  nerve: 'Nerve pattern',
  weakness: 'Weakness pattern',
  possible_fracture: 'Possible-fracture pattern',
  severe_pain: 'Severe-pain pattern',
  headache_fluid_shift: 'Fluid-shift / CO₂ headache pattern',
  trunk_front: 'Chest / abdomen — medical officer check',
  muscle_strain: 'Muscle strain / inflammation pattern',
  tendon_irritation: 'Muscle–tendon irritation pattern',
  tightness: 'Tightness / strain pattern',
  joint_irritation: 'Joint irritation pattern',
  nonspecific: 'Non-specific / deconditioning pattern',
}
