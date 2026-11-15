import { describe, expect, it } from 'vitest'
import { DURATIONS, FALSE_START_MS, LAPSE_MS, MIN_TRIALS, nextWaitMs, summarize, TIMEOUT_MS } from './pvt'

const steady = (n: number, rt = 250) => Array.from({ length: n }, () => rt)

describe('summarize', () => {
  it('computes median, mean and lapses from valid responses', () => {
    const r = summarize({ rts: [200, 220, 240, 260, 280, 300, 320, 360, 400, 500], falseStarts: 0 })
    expect(r.ok).toBe(true)
    expect(r.valid).toBe(10)
    expect(r.medianRT).toBe(290)
    expect(r.meanRT).toBe(308)
    expect(r.lapses).toBe(3) // 360, 400, 500
    expect(r.lapsePct).toBe(30)
    expect(r.fastest10).toBe(200)
    expect(r.slowest10).toBe(500)
    expect(r.score).toBe(70)
  })
  it('counts a lapse at exactly the limit and not just under it', () => {
    expect(summarize({ rts: [...steady(9), LAPSE_MS], falseStarts: 0 }).lapses).toBe(1)
    expect(summarize({ rts: [...steady(9), LAPSE_MS - 1], falseStarts: 0 }).lapses).toBe(0)
  })
  it('handles odd and even counts for the median', () => {
    expect(summarize({ rts: [210, 230, 250, 270, 290], falseStarts: 0 }).medianRT).toBe(250)
    expect(summarize({ rts: [210, 230, 250, 270, 290, 310], falseStarts: 0 }).medianRT).toBe(260)
  })
  it('counts early presses separately and lowers the score', () => {
    const r = summarize({ rts: steady(9), falseStarts: 1 })
    expect(r.ok).toBe(true)
    expect(r.falseStarts).toBe(1)
    expect(r.n).toBe(10)
    expect(r.score).toBe(90)
  })
  it('treats a recorded reaction under the anticipation limit as early, not valid', () => {
    const r = summarize({ rts: [...steady(8), FALSE_START_MS - 1, 50], falseStarts: 0 })
    expect(r.valid).toBe(8)
    expect(r.falseStarts).toBe(2)
  })
  it('counts a timeout as a very slow response (a lapse), not a missing one', () => {
    const r = summarize({ rts: [...steady(9), TIMEOUT_MS], falseStarts: 0 })
    expect(r.lapses).toBe(1)
    expect(r.slowest10).toBe(TIMEOUT_MS)
  })
  it('is No data, never fine, with too few valid responses', () => {
    const r = summarize({ rts: steady(MIN_TRIALS - 1), falseStarts: 0 })
    expect(r.ok).toBe(false)
    expect(r.note).toMatch(/valid responses/)
    expect(summarize({ rts: [], falseStarts: 0 }).ok).toBe(false)
  })
  it('is No data when most presses were guesses', () => {
    const r = summarize({ rts: steady(6), falseStarts: 5 })
    expect(r.ok).toBe(false)
    expect(r.note).toMatch(/too early/)
  })
  it('ignores junk values', () => {
    const r = summarize({ rts: [...steady(6), NaN, Infinity as number], falseStarts: 0 })
    expect(r.valid).toBe(6)
  })
})

describe('nextWaitMs', () => {
  it('stays between 1 and 4 seconds', () => {
    expect(nextWaitMs(0)).toBe(1000)
    expect(nextWaitMs(0.5)).toBe(2500)
    expect(nextWaitMs(1)).toBeLessThan(4000)
    expect(nextWaitMs(-3)).toBe(1000)
    expect(nextWaitMs(9)).toBeLessThan(4000)
  })
})

describe('durations', () => {
  it('are whole seconds long enough to get the minimum number of responses', () => {
    for (const d of DURATIONS) expect(d.seconds / 4).toBeGreaterThan(MIN_TRIALS)
  })
})
