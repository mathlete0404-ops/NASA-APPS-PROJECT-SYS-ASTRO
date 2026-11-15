// Space Exchange: a made-up stock market for pet care points. Purely a game.
//
// - Companies, tickers and prices are invented. No real market data, no real money, no advice.
// - Prices are a deterministic function of the clock (a seeded, mean-reverting random walk), so they
//   work offline, are the same on every device, and can be tested exactly.
// - It never touches health results, status, triage or the pet's growth.
// Pure logic: no store, no DOM, the clock is always passed in.

export interface Stock {
  id: string
  name: string
  blurb: string
  /** Long-run price in care points. */
  base: number
  /** Typical hourly move (0.01 = 1%). */
  vol: number
}

export const STOCKS: readonly Stock[] = [
  { id: 'ORAT', name: 'Orbital Oats Co.', blurb: 'Breakfast for the whole station. Slow and steady.', base: 12, vol: 0.008 },
  { id: 'LAMP', name: 'Lunar Lamp Works', blurb: 'Makes the lights that never go out.', base: 24, vol: 0.015 },
  { id: 'FERN', name: 'Zero-G Fern Farms', blurb: 'Leafy greens that grow in any direction.', base: 18, vol: 0.02 },
  { id: 'NOVA', name: 'Nova Noodles', blurb: 'Instant ramen, now with a rocket flavour.', base: 30, vol: 0.025 },
  { id: 'COMT', name: 'Comet Couriers', blurb: 'Fast delivery, when the comet is in range.', base: 40, vol: 0.03 },
  { id: 'ECHO', name: 'Echo Radio', blurb: 'Plays your song back from the far side of the Moon.', base: 55, vol: 0.04 },
]

export const stockById = (id: string): Stock | undefined => STOCKS.find((s) => s.id === id)

/** Price is clamped to this band around the long-run price, so nothing ever goes to zero or to the sky. */
export const BAND = { lo: 0.35, hi: 3 }
const PULL = 0.03 // hourly pull back towards the long-run price

/** Fixed start of every price path (Sun 1 Nov 2026, 00:00 UTC). */
export const ANCHOR_MS = Date.UTC(2026, 10, 1)
const HOUR = 3.6e6

const fnv = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
/** Deterministic uniform [0,1) from a seed and a counter. */
const rnd = (seed: number, n: number): number => {
  let x = (seed + Math.imul(n + 1, 0x9e3779b1)) >>> 0
  x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b)
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}
/** Roughly standard normal: three uniforms, centred and scaled. */
const shock = (seed: number, h: number): number => (rnd(seed, h * 3) + rnd(seed, h * 3 + 1) + rnd(seed, h * 3 + 2) - 1.5) / 0.5

// Each stock's path is built hour by hour from the anchor and kept, so a lookup is one array read.
const paths = new Map<string, number[]>()
function logPath(s: Stock, hours: number): number[] {
  let p = paths.get(s.id)
  if (!p) { p = [Math.log(s.base)]; paths.set(s.id, p) }
  const seed = fnv(s.id)
  const mid = Math.log(s.base), lo = Math.log(s.base * BAND.lo), hi = Math.log(s.base * BAND.hi)
  while (p.length <= hours) {
    const h = p.length
    const prev = p[h - 1]
    p.push(Math.min(hi, Math.max(lo, prev + PULL * (mid - prev) + s.vol * shock(seed, h))))
  }
  return p
}

export const hourIndex = (nowMs: number): number => Math.max(0, Math.floor((nowMs - ANCHOR_MS) / HOUR))
const round1 = (x: number) => Math.round(x * 10) / 10

/** Price in care points at a time (one decimal). */
export function priceAt(s: Stock, nowMs: number): number {
  const h = hourIndex(nowMs)
  return Math.max(0.1, round1(Math.exp(logPath(s, h)[h])))
}

/** Hourly prices, oldest first, ending with the current hour. */
export function priceSeries(s: Stock, nowMs: number, hours = 48): number[] {
  const end = hourIndex(nowMs)
  const p = logPath(s, end)
  const out: number[] = []
  for (let h = Math.max(0, end - hours + 1); h <= end; h++) out.push(Math.max(0.1, round1(Math.exp(p[h]))))
  return out
}

/** Change over the last 24 hours, as a fraction (0.05 = +5%). */
export function change24h(s: Stock, nowMs: number): number {
  const end = hourIndex(nowMs)
  const p = logPath(s, end)
  const before = Math.exp(p[Math.max(0, end - 24)])
  return Math.exp(p[end]) / before - 1
}

/** What buying costs and selling pays. Whole points, rounded against the trader, so a round trip can never make points from nothing. */
export const buyCost = (price: number, shares: number): number => Math.ceil(price * shares - 1e-9)
export const sellValue = (price: number, shares: number): number => Math.floor(price * shares + 1e-9)
