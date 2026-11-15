import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import triageCases from '../../../shared/triage_cases.json'
import statusCases from '../../../shared/status_cases.json'
import { metricStatus } from './status'
import { triage, type TriageInput } from './triage'
import { estimateHeartRate } from './rppg'

// Seeded noise so the signal tests give the same result on every run (Math.random made CI flaky).
const seeded = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seeded(20261115)) })
afterEach(() => { vi.restoreAllMocks() })

describe('triage (shared cases with Python)', () => {
  for (const c of triageCases) {
    it(c.name, () => {
      const got = triage(c.input as unknown as TriageInput)
      for (const [k, v] of Object.entries(c.expect)) expect(got[k as keyof typeof got]).toEqual(v)
      expect(got.reasons.length).toBeGreaterThan(0)
    })
  }
})

describe('status (shared cases with Python)', () => {
  for (const c of statusCases) {
    it(c.name, () => {
      const got = metricStatus(c.metric, c.history as [number, boolean][])
      expect(got.level).toBe(c.expect.level)
      expect(got.reasons.length).toBeGreaterThan(0)
    })
  }
})

describe('rPPG heart-rate estimate', () => {
  const fps = 30
  const synth = (bpm: number, noise: number, seconds = 30) =>
    Array.from({ length: fps * seconds }, (_, i) => {
      const t = i / fps
      const p = Math.sin(2 * Math.PI * (bpm / 60) * t)
      const n = () => (Math.random() - 0.5) * noise
      return { t: t * 1000, r: 150 + 0.3 * p + n(), g: 110 + 1.0 * p + n(), b: 90 + 0.2 * p + n() }
    })

  it('recovers a clean 72 bpm pulse', () => {
    const r = estimateHeartRate(synth(72, 0.2))
    expect(r.ok).toBe(true)
    expect(Math.abs(r.bpm! - 72)).toBeLessThan(3)
  })

  it('returns No data on pure noise (never a fake number)', () => {
    const r = estimateHeartRate(synth(72, 0).map((s) => ({ ...s, r: 150 + Math.random() * 6, g: 110 + Math.random() * 6, b: 90 + Math.random() * 6 })))
    expect(r.ok).toBe(false)
  })

  it('returns No data when too short', () => {
    expect(estimateHeartRate(synth(72, 0.2, 4)).ok).toBe(false)
  })
})
