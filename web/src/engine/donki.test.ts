import { describe, expect, it } from 'vitest'
import { buildDonki, donkiAdvice, donkiUrls, flareScore, parseFlares, parseSep, parseStorms } from './donki'

const NOW = Date.UTC(2026, 10, 15, 12, 0, 0)
const ago = (h: number) => new Date(NOW - h * 3.6e6).toISOString().slice(0, 16) + 'Z' // DONKI style: minute precision, Z
const flr = (cls: string, h: number) => ({ flrID: `F-${cls}-${h}`, classType: cls, peakTime: ago(h) })
const sep = (h: number) => ({ sepID: `S-${h}`, eventTime: ago(h) })
const gst = (kps: number[], h: number) => ({ gstID: `G-${h}`, startTime: ago(h), allKpIndex: kps.map((k) => ({ kpIndex: k })) })

describe('parsers', () => {
  it('reads flares, ignoring rows without a valid class or time', () => {
    const f = parseFlares([flr('M2.1', 5), flr('X1.0', 30), { classType: 'ZZ9', peakTime: ago(1) }, { classType: 'C3.0' }, null, 'x'])
    expect(f.map((x) => x.cls)).toEqual(['X1.0', 'M2.1'])
    expect(f[0].letter).toBe('X')
    expect(f[1].mag).toBe(2.1)
  })
  it('treats times without a zone as UTC', () => {
    const f = parseFlares([{ classType: 'M1.0', peakTime: '2026-11-15T10:00' }])
    expect(f[0].peak).toBe(Date.UTC(2026, 10, 15, 10, 0))
  })
  it('reads particle events and the highest Kp of a storm', () => {
    expect(parseSep([sep(10), { eventTime: 'nope' }])).toHaveLength(1)
    expect(parseStorms([gst([3, 6, 7], 10), gst([], 20)]).map((g) => g.kp)).toEqual([0, 7])
  })
  it('returns nothing for non-arrays (an error page, an empty body)', () => {
    expect(parseFlares({ error: 1 })).toEqual([])
    expect(parseSep('<html>')).toEqual([])
    expect(parseStorms(null)).toEqual([])
  })
  it('ranks flares by class then size', () => {
    const [m5, x1] = parseFlares([flr('M5.0', 3), flr('X1.0', 2)]).sort((a, b) => flareScore(a) - flareScore(b))
    expect(m5.cls).toBe('M5.0')
    expect(x1.cls).toBe('X1.0')
  })
})

describe('donkiAdvice', () => {
  const build = (f: unknown[] = [], s: unknown[] = [], g: unknown[] = []) => buildDonki(f, s, g, NOW)
  it('is quiet with nothing recent, and says so plainly', () => {
    const a = donkiAdvice(build([flr('C2.0', 100)]), NOW, 'transit')
    expect(a.level).toBe('quiet')
    expect(a.action).toBe('')
    expect(a.facts[0]).toMatch(/Strongest flare in 7 days: C2\.0/)
  })
  it('raises an alert for a particle event beyond Earth, and only a watch near it', () => {
    const d = build([], [sep(10)])
    expect(donkiAdvice(d, NOW, 'transit').level).toBe('alert')
    expect(donkiAdvice(d, NOW, 'surface').level).toBe('alert')
    expect(donkiAdvice(d, NOW, 'landing').level).toBe('watch')
    expect(donkiAdvice(d, NOW, 'transit').action).toMatch(/shielded|flight rules/i)
  })
  it('never alarms people on the ground', () => {
    const d = build([flr('X2.0', 3)], [sep(10)], [gst([8], 5)])
    for (const ph of ['preflight', 'return'] as const) {
      const a = donkiAdvice(d, NOW, ph)
      expect(a.level).not.toBe('alert')
      expect(a.action).toMatch(/no action/i)
    }
  })
  it('ignores particle events older than 72 h and future-dated ones', () => {
    expect(donkiAdvice(build([], [sep(80)]), NOW, 'transit').level).toBe('quiet')
    expect(donkiAdvice(build([], [sep(-5)]), NOW, 'transit').level).toBe('quiet')
  })
  it('watches an X flare in the last 24 h but not an M flare or an old X flare', () => {
    expect(donkiAdvice(build([flr('X1.2', 6)]), NOW, 'transit').level).toBe('watch')
    expect(donkiAdvice(build([flr('M9.9', 6)]), NOW, 'transit').level).toBe('quiet')
    expect(donkiAdvice(build([flr('X1.2', 30)]), NOW, 'transit').level).toBe('quiet')
  })
  it('watches severe storms (Kp 7 or more) in the last 48 h only', () => {
    expect(donkiAdvice(build([], [], [gst([5, 7], 10)]), NOW, 'surface').level).toBe('watch')
    expect(donkiAdvice(build([], [], [gst([5, 6], 10)]), NOW, 'surface').level).toBe('quiet')
    expect(donkiAdvice(build([], [], [gst([8], 60)]), NOW, 'surface').level).toBe('quiet')
  })
  it('gives the particle event priority over flares and storms', () => {
    expect(donkiAdvice(build([flr('X3.0', 2)], [sep(4)], [gst([9], 3)]), NOW, 'transit').title).toMatch(/particle/i)
  })
  it('counts M and X flares in the week', () => {
    const a = donkiAdvice(build([flr('M1.0', 20), flr('M2.0', 60), flr('C5.0', 70), flr('X1.0', 100)]), NOW, 'transit')
    expect(a.facts[0]).toMatch(/X1\.0/)
    expect(a.facts[0]).toMatch(/3 M or X class/)
  })
})

describe('donkiUrls', () => {
  it('builds NASA gateway and DONKI service URLs with the dates and key', () => {
    const [gw, svc] = donkiUrls('FLR', '2026-11-08', '2026-11-15')
    expect(gw).toContain('api.nasa.gov/DONKI/FLR')
    expect(gw).toContain('startDate=2026-11-08')
    expect(gw).toContain('api_key=DEMO_KEY')
    expect(svc).toContain('kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR')
    expect(svc).not.toContain('api_key')
  })
  it('escapes a custom key', () => {
    expect(donkiUrls('SEP', 'a', 'b', 'k&y=1')[0]).toContain('api_key=k%26y%3D1')
  })
})
