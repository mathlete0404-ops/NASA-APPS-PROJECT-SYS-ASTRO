import { describe, expect, it } from 'vitest'
import { isStale, parseProtons, stormAdvice, stormLevel, summarize, STALE_MS } from './spaceweather'

describe('NOAA S-scale', () => {
  it('maps flux to levels at the exact thresholds', () => {
    expect(stormLevel(0.2).scale).toBe(0)
    expect(stormLevel(9.99).scale).toBe(0)
    expect(stormLevel(10).scale).toBe(1)
    expect(stormLevel(99).scale).toBe(1)
    expect(stormLevel(100).scale).toBe(2)
    expect(stormLevel(1000).scale).toBe(3)
    expect(stormLevel(1e4).scale).toBe(4)
    expect(stormLevel(1e5).scale).toBe(5)
    expect(stormLevel(1e7).scale).toBe(5)
  })
  it('treats garbage as quiet instead of inventing a storm', () => {
    expect(stormLevel(NaN).scale).toBe(0)
    expect(stormLevel(-5).scale).toBe(0)
  })
})

describe('parseProtons', () => {
  const rows = [
    { time_tag: '2026-11-14T00:00:00Z', satellite: 19, flux: 0.3, energy: '>=10 MeV' },
    { time_tag: '2026-11-14T00:00:00Z', satellite: 19, flux: 0.05, energy: '>=50 MeV' },
    { time_tag: '2026-11-14T00:05:00Z', satellite: 19, flux: 12.5, energy: '>=10 MeV' },
    { time_tag: 'not a date', satellite: 19, flux: 4, energy: '>=10 MeV' },
    { time_tag: '2026-11-14T00:10:00Z', satellite: 19, flux: -1, energy: '>=10 MeV' },
    { time_tag: '2026-11-14T00:15:00Z', satellite: 19, flux: '7', energy: '>=10 MeV' },
    null,
  ]
  it('keeps only valid >=10 MeV rows, sorted by time', () => {
    const s = parseProtons([...rows].reverse())
    expect(s.map((x) => x.flux)).toEqual([0.3, 12.5])
  })
  it('returns nothing for a non-array body (e.g. an HTML error page)', () => {
    expect(parseProtons({ error: 'x' })).toEqual([])
    expect(parseProtons('<html>')).toEqual([])
  })
})

describe('summarize', () => {
  it('reports latest and 24 h peak separately', () => {
    const w = summarize([{ t: 1, flux: 150 }, { t: 2, flux: 4 }], 99)!
    expect(w.now.scale).toBe(0)
    expect(w.peakLevel.scale).toBe(2)
    expect(w.peak.t).toBe(1)
  })
  it('is null with no data (shown as "No data", never "Quiet")', () => {
    expect(summarize([], 0)).toBeNull()
  })
  it('flags old readings as stale', () => {
    const w = summarize([{ t: 1000, flux: 1 }], 0)!
    expect(isStale(w, 1000 + STALE_MS - 1)).toBe(false)
    expect(isStale(w, 1000 + STALE_MS + 1)).toBe(true)
  })
})

describe('stormAdvice', () => {
  it('sends strong storms in flight to shelter and flags urgent', () => {
    const a = stormAdvice(stormLevel(2000), 'transit')
    expect(a.urgent).toBe(true)
    expect(a.actions.join(' ')).toMatch(/shield/i)
  })
  it('does not alarm Earth-bound phases', () => {
    expect(stormAdvice(stormLevel(5000), 'preflight').urgent).toBe(false)
    expect(stormAdvice(stormLevel(5000), 'return').urgent).toBe(false)
  })
  it('keeps moderate storms non-urgent but asks for a dosimeter check', () => {
    const a = stormAdvice(stormLevel(150), 'surface')
    expect(a.urgent).toBe(false)
    expect(a.actions.join(' ')).toMatch(/dosimeter/i)
  })
})
