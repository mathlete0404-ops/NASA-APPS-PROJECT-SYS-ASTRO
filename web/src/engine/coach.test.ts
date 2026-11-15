import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { angle3, initCoach, stepCoach, formScore, type Joints } from './coach'
import { estimateBreathing } from './resp'

// Seeded noise so the signal tests give the same result on every run (Math.random made CI flaky).
const seeded = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(20261115)) })
afterEach(() => { vi.restoreAllMocks() })

const J = (knee: number, extra: Partial<Joints> = {}): Joints => ({
  kneeL: knee, kneeR: knee, hipL: 170, hipR: 170, shoulderL: 20, shoulderR: 20, trunkLean: 10,
  kneeGap: 0.25, ankleGap: 0.25, heelLift: 0.07, ok: true, ...extra,
})

describe('exercise coach', () => {
  it('angle3 measures a right angle', () => {
    expect(Math.round(angle3([1, 0, 0], [0, 0, 0], [0, 1, 0]))).toBe(90)
  })
  it('counts clean squats with no faults', () => {
    let s = initCoach()
    let t = 0
    for (let r = 0; r < 3; r++) for (const k of [170, 140, 110, 95, 110, 140, 170]) s = stepCoach('squat', s, J(k), (t += 400))
    expect(s.reps.length).toBe(3)
    expect(formScore(s.reps)).toBe(100)
  })
  it('flags knees caving in and shallow depth', () => {
    let s = initCoach()
    let t = 0
    for (const k of [170, 140, 112, 108, 112, 140, 170]) s = stepCoach('squat', s, J(k, { kneeGap: 0.12, ankleGap: 0.25 }), (t += 400))
    expect(s.reps[0].faults).toContain('valgus')
    expect(s.reps[0].faults).toContain('shallow')
    expect(formScore(s.reps)).toBe(0)
  })
  it('records shoulder range on arm raises', () => {
    let s = initCoach()
    let t = 0
    for (const a of [20, 80, 140, 165, 140, 80, 20]) s = stepCoach('arm_raise', s, J(170, { shoulderL: a, shoulderR: a - 10 }), (t += 400))
    expect(s.reps.length).toBe(1)
    expect(Math.round(s.romMaxL)).toBe(165)
  })
})

describe('breathing estimate', () => {
  const synth = (bpm: number, noise: number, seconds = 40) => Array.from({ length: seconds * 15 }, (_, i) => {
    const t = i / 15
    return { t: t * 1000, y: 0.5 + 0.002 * Math.sin(2 * Math.PI * (bpm / 60) * t) + (Math.random() - 0.5) * noise, g: null }
  })
  it('recovers 14 breaths/min', () => {
    const r = estimateBreathing(synth(14, 0.0005))
    expect(r.ok).toBe(true)
    expect(Math.abs(r.bpm! - 14)).toBeLessThanOrEqual(1)
  })
  it('No data on noise', () => {
    expect(estimateBreathing(synth(14, 0).map((s) => ({ ...s, y: 0.5 + (Math.random() - 0.5) * 0.01 }))).ok).toBe(false)
  })
  it('No data when too short', () => {
    expect(estimateBreathing(synth(14, 0.0005, 15)).ok).toBe(false)
  })
  it('recovers 9 and 22 breaths/min within 1 (60 s, realistic noise)', () => {
    for (const bpm of [9, 22]) {
      const r = estimateBreathing(synth(bpm, 0.0025, 60))
      expect(r.ok).toBe(true)
      expect(Math.abs(r.bpm! - bpm)).toBeLessThanOrEqual(1)
    }
  })
  it('No data when the rhythm changes half-way', () => {
    const a = synth(10, 0.0005, 30), b = synth(24, 0.0005, 30).map((s) => ({ ...s, t: s.t + 30000 }))
    expect(estimateBreathing([...a, ...b]).ok).toBe(false)
  })
})
