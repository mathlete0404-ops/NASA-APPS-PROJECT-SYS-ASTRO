import { describe, expect, it } from 'vitest'
import { STAGES } from './pet'
import { ANCHOR_MS, BAND, buyCost, change24h, hourIndex, priceAt, priceSeries, sellValue, STOCKS } from './market'
import {
  buyShares, collectTrip, EMPTY_GAME, fmtMult, LANDMARKS, LEVEL_MULT, marketOpen, nextLandmark, payout, positions, ROUTES, routeById,
  routeOpen, sanitizeGame, sellShares, startTrip, toMiles, tripState, type Game,
} from './petgame'

const HOUR = 3.6e6
const T0 = Date.UTC(2026, 10, 15, 12, 0, 0)

describe('level multiplier', () => {
  it('rises with the level and is never below 1', () => {
    const m = STAGES.map((s) => LEVEL_MULT[s.id])
    for (let i = 1; i < m.length; i++) expect(m[i]).toBeGreaterThanOrEqual(m[i - 1])
    expect(Math.min(...m)).toBe(1)
    expect(LEVEL_MULT.veteran).toBe(2)
  })
  it('scales trip rewards and rounds to whole points', () => {
    const moon = routeById('moon')!
    expect(payout(moon, 'hatchling')).toBe(14)
    expect(payout(moon, 'cadet')).toBe(18) // 14 x 1.25 = 17.5
    expect(payout(moon, 'explorer')).toBe(21)
    expect(payout(moon, 'veteran')).toBe(28)
  })
  it('formats the multiplier for display', () => {
    expect(fmtMult(1.25)).toBe('×1.25')
    expect(fmtMult(2)).toBe('×2')
  })
})

describe('routes', () => {
  it('have unique ids, whole positive hours, distances and rewards, real stages', () => {
    const ids = new Set<string>()
    const stages = new Set(STAGES.map((s) => s.id as string))
    for (const r of ROUTES) {
      expect(ids.has(r.id)).toBe(false)
      ids.add(r.id)
      expect(r.hours).toBeGreaterThan(0)
      expect(r.km).toBeGreaterThan(0)
      expect(Number.isInteger(r.base) && r.base > 0).toBe(true)
      if (r.minStage) expect(stages.has(r.minStage)).toBe(true)
    }
  })
  it('pay more per hour on longer trips, so waiting longer is a fair choice', () => {
    const perHour = ROUTES.map((r) => r.base / r.hours)
    for (let i = 1; i < perHour.length; i++) expect(perHour[i]).toBeGreaterThanOrEqual(perHour[i - 1])
  })
  it('keeps the shortest trip open to everyone and long ones behind levels', () => {
    expect(routeOpen(ROUTES[0], 'hatchling')).toBe(true)
    expect(routeOpen(routeById('jupiter')!, 'explorer')).toBe(false)
    expect(routeOpen(routeById('jupiter')!, 'veteran')).toBe(true)
  })
})

describe('trips', () => {
  it('start, travel, return and collect', () => {
    const s = startTrip(EMPTY_GAME, 'lap', T0, 'hatchling')
    expect(s.ok).toBe(true)
    if (!s.ok) return
    const mid = tripState(s.game, T0 + 0.5 * HOUR, 'hatchling')
    expect(mid.kind).toBe('away')
    if (mid.kind === 'away') { expect(mid.progress).toBeCloseTo(0.5); expect(mid.remainingMs).toBeCloseTo(0.5 * HOUR) }
    expect(collectTrip(s.game, T0 + 0.5 * HOUR, 'hatchling')).toBeNull()
    expect(tripState(s.game, T0 + HOUR, 'hatchling').kind).toBe('back')
    const c = collectTrip(s.game, T0 + HOUR, 'hatchling')!
    expect(c.reward).toBe(3)
    expect(c.game.credit).toBe(3)
    expect(c.game.km).toBe(40_075)
    expect(c.game.trips).toBe(1)
    expect(c.game.trip).toBeNull()
    expect(tripState(c.game, T0 + 2 * HOUR, 'hatchling').kind).toBe('idle')
  })
  it('never expire: coming back days late still pays in full', () => {
    const s = startTrip(EMPTY_GAME, 'moon', T0, 'cadet')
    if (!s.ok) throw new Error('setup')
    expect(collectTrip(s.game, T0 + 90 * 24 * HOUR, 'cadet')!.reward).toBe(18)
  })
  it('pay at the level the pet has when it comes home', () => {
    const s = startTrip(EMPTY_GAME, 'moon', T0, 'hatchling')
    if (!s.ok) throw new Error('setup')
    expect(collectTrip(s.game, T0 + 5 * HOUR, 'cadet')!.reward).toBe(18)
  })
  it('only one trip at a time, and locked routes stay locked', () => {
    const s = startTrip(EMPTY_GAME, 'lap', T0, 'cadet')
    if (!s.ok) throw new Error('setup')
    expect(startTrip(s.game, 'moon', T0, 'cadet')).toEqual({ ok: false, reason: 'busy' })
    expect(startTrip(EMPTY_GAME, 'jupiter', T0, 'cadet')).toEqual({ ok: false, reason: 'locked' })
    expect(startTrip(EMPTY_GAME, 'nope', T0, 'cadet')).toEqual({ ok: false, reason: 'unknown' })
  })
  it('does not mutate the game it was given', () => {
    const g: Game = { ...EMPTY_GAME }
    startTrip(g, 'lap', T0, 'cadet')
    expect(g.trip).toBeNull()
  })
})

describe('odometer', () => {
  it('converts km to miles', () => {
    expect(toMiles(1.609344)).toBeCloseTo(1)
    expect(Math.round(toMiles(384_400))).toBe(238_855)
  })
  it('points at the next landmark and finishes at the last', () => {
    expect(nextLandmark(0)).toMatchObject({ name: 'once around the Earth', progress: 0 })
    expect(nextLandmark(40_075)?.name).toBe('the Moon')
    expect(nextLandmark(LANDMARKS[LANDMARKS.length - 1].km)).toBeNull()
  })
  it('lists landmarks in increasing order', () => {
    for (let i = 1; i < LANDMARKS.length; i++) expect(LANDMARKS[i].km).toBeGreaterThan(LANDMARKS[i - 1].km)
  })
})

describe('Space Exchange prices', () => {
  const orat = STOCKS[0]
  it('are the same every time for the same moment (deterministic)', () => {
    const a = STOCKS.map((s) => priceAt(s, T0))
    const b = STOCKS.map((s) => priceAt(s, T0))
    expect(a).toEqual(b)
  })
  it('stay constant inside an hour and move between hours', () => {
    expect(priceAt(orat, T0)).toBe(priceAt(orat, T0 + 30 * 60_000 - (T0 % HOUR)))
    const echo = STOCKS.find((s) => s.id === 'ECHO')!
    expect(new Set(priceSeries(echo, T0, 72)).size).toBeGreaterThan(20)
    expect(new Set(priceSeries(orat, T0, 72)).size).toBeGreaterThan(3) // even the steady one moves
  })
  it('stay inside the band around the long-run price, for months', () => {
    for (const s of STOCKS) {
      const series = priceSeries(s, ANCHOR_MS + 200 * 24 * HOUR, 200 * 24)
      for (const p of series) {
        expect(p).toBeGreaterThanOrEqual(Math.round(s.base * BAND.lo * 10) / 10 - 0.1)
        expect(p).toBeLessThanOrEqual(s.base * BAND.hi + 0.1)
        expect(p).toBeGreaterThan(0)
      }
    }
  })
  it('revert: the long-run average sits near the base price', () => {
    for (const s of STOCKS) {
      const series = priceSeries(s, ANCHOR_MS + 300 * 24 * HOUR, 300 * 24)
      const mean = series.reduce((a, b) => a + b, 0) / series.length
      expect(mean / s.base).toBeGreaterThan(0.75)
      expect(mean / s.base).toBeLessThan(1.4)
    }
  })
  it('wilder stocks swing more than steady ones', () => {
    const range = (id: string) => { const sr = priceSeries(STOCKS.find((s) => s.id === id)!, ANCHOR_MS + 200 * 24 * HOUR, 200 * 24); const b = STOCKS.find((s) => s.id === id)!.base; return (Math.max(...sr) - Math.min(...sr)) / b }
    expect(range('ECHO')).toBeGreaterThan(range('ORAT'))
  })
  it('returns a series that ends with the current price and has the asked length', () => {
    const s = priceSeries(orat, T0, 48)
    expect(s).toHaveLength(48)
    expect(s[47]).toBe(priceAt(orat, T0))
    expect(Number.isFinite(change24h(orat, T0))).toBe(true)
  })
  it('handles times before the anchor without breaking', () => {
    expect(hourIndex(0)).toBe(0)
    expect(priceAt(orat, 0)).toBeGreaterThan(0)
  })
  it('has unique tickers and no real company names', () => {
    expect(new Set(STOCKS.map((s) => s.id)).size).toBe(STOCKS.length)
    for (const s of STOCKS) expect(/nasa|apple|tesla|google|amazon|spacex/i.test(s.name + s.blurb)).toBe(false)
  })
})

describe('Space Exchange trades', () => {
  const nova = STOCKS.find((s) => s.id === 'NOVA')!
  const price = priceAt(nova, T0)
  it('rounds against the trader so a round trip never makes points from nothing', () => {
    for (const p of [1.1, 12.3, 29.9, 30.1, 55.5]) {
      for (const n of [1, 2, 3, 7, 10]) expect(sellValue(p, n)).toBeLessThanOrEqual(buyCost(p, n))
    }
  })
  it('buying costs points, adds shares and refuses when you cannot afford it', () => {
    const r = buyShares(EMPTY_GAME, 'NOVA', 2, T0, 1000, 'cadet')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.game.credit).toBe(-buyCost(price, 2))
    expect(r.game.holdings.NOVA).toEqual({ shares: 2, cost: buyCost(price, 2) })
    expect(buyShares(EMPTY_GAME, 'NOVA', 2, T0, buyCost(price, 2) - 1, 'cadet')).toEqual({ ok: false, reason: 'poor' })
  })
  it('is closed below Cadet, and rejects bad share counts and unknown tickers', () => {
    expect(marketOpen('hatchling')).toBe(false)
    expect(marketOpen('cadet')).toBe(true)
    expect(buyShares(EMPTY_GAME, 'NOVA', 1, T0, 999, 'hatchling')).toEqual({ ok: false, reason: 'locked' })
    for (const n of [0, -1, 1.5, 1000, NaN]) expect(buyShares(EMPTY_GAME, 'NOVA', n, T0, 999, 'cadet')).toEqual({ ok: false, reason: 'shares' })
    expect(buyShares(EMPTY_GAME, 'XXXX', 1, T0, 999, 'cadet')).toEqual({ ok: false, reason: 'unknown' })
  })
  it('selling pays the current value, keeps the cost basis in proportion, and clears empty holdings', () => {
    const b = buyShares(EMPTY_GAME, 'NOVA', 4, T0, 1000, 'cadet')
    if (!b.ok) throw new Error('setup')
    const later = T0 + 10 * HOUR
    const s1 = sellShares(b.game, 'NOVA', 1, later)
    expect(s1.ok).toBe(true)
    if (!s1.ok) return
    expect(s1.game.holdings.NOVA.shares).toBe(3)
    expect(s1.game.holdings.NOVA.cost).toBe(Math.round(b.game.holdings.NOVA.cost * 0.75))
    expect(s1.game.credit).toBe(b.game.credit + sellValue(priceAt(nova, later), 1))
    const s2 = sellShares(s1.game, 'NOVA', 3, later)
    expect(s2.ok && s2.game.holdings.NOVA).toBeUndefined()
  })
  it('cannot sell what you do not hold, and can sell even if the level changed', () => {
    expect(sellShares(EMPTY_GAME, 'NOVA', 1, T0)).toEqual({ ok: false, reason: 'none' })
    const b = buyShares(EMPTY_GAME, 'NOVA', 2, T0, 1000, 'cadet')
    if (!b.ok) throw new Error('setup')
    expect(sellShares(b.game, 'NOVA', 3, T0)).toEqual({ ok: false, reason: 'shares' })
    expect(sellShares(b.game, 'NOVA', 2, T0).ok).toBe(true)
  })
  it('values positions at the sell price', () => {
    const b = buyShares(EMPTY_GAME, 'LAMP', 3, T0, 1000, 'cadet')
    if (!b.ok) throw new Error('setup')
    const [p] = positions(b.game, T0)
    expect(p.value).toBe(sellValue(priceAt(STOCKS.find((s) => s.id === 'LAMP')!, T0), 3))
    expect(p.gain).toBe(p.value - p.cost)
    expect(p.gain).toBeLessThanOrEqual(0) // right after buying you are never ahead
  })
})

describe('sanitizeGame', () => {
  it('returns an empty game for junk', () => {
    expect(sanitizeGame(null)).toEqual(EMPTY_GAME)
    expect(sanitizeGame('x')).toEqual(EMPTY_GAME)
  })
  it('keeps good data and drops bad parts', () => {
    const g = sanitizeGame({
      credit: 12.4, km: 500, trips: 2.9,
      trip: { route: 'moon', start: 123 },
      holdings: { NOVA: { shares: 3, cost: 80.6 }, XXXX: { shares: 1, cost: 1 }, ECHO: { shares: 1.5, cost: 5 }, LAMP: { shares: 0, cost: 0 } },
    })
    expect(g.credit).toBe(12)
    expect(g.km).toBe(500)
    expect(g.trips).toBe(2)
    expect(g.trip).toEqual({ route: 'moon', start: 123 })
    expect(g.holdings).toEqual({ NOVA: { shares: 3, cost: 81 } })
  })
  it('drops a trip to an unknown route or with a bad start', () => {
    expect(sanitizeGame({ trip: { route: 'warp', start: 1 } }).trip).toBeNull()
    expect(sanitizeGame({ trip: { route: 'lap', start: -5 } }).trip).toBeNull()
    expect(sanitizeGame({ km: -9, trips: NaN }).km).toBe(0)
  })
})
