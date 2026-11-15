// Pet trips and the Space Exchange: ways for the crew pet to bring home care points.
//
// Design rules (same spirit as engine/pet.ts and engine/petshop.ts):
// - A trip is a wait, not a chore. It never expires, never fails and nothing is lost if you come back late,
//   so there is nothing to feel guilty about. Only one trip runs at a time.
// - The pet's level multiplies what a trip brings back. The multiplier is a reward for showing up over
//   weeks, never for good results.
// - The Space Exchange is a made-up market (see engine/market.ts). It is opt-in, opens at Cadet, and
//   only ever moves game points. It cannot touch accessories, status, triage or the pet's growth.
// Pure logic: no store, no DOM, the clock is always passed in.
import type { StageId } from './pet'
import { buyCost, priceAt, sellValue, stockById, STOCKS } from './market'

export interface Trip { route: string; start: number }
export interface Holding { shares: number; cost: number }

export interface Game {
  /** Points won or spent here: trip rewards, and the money moved by Space Exchange trades. Can be negative while invested. */
  credit: number
  trip: Trip | null
  /** Odometer: total distance flown on finished trips, in km. */
  km: number
  trips: number
  holdings: Record<string, Holding>
}

export const EMPTY_GAME: Game = { credit: 0, trip: null, km: 0, trips: 0, holdings: {} }

const ORDER: StageId[] = ['egg', 'hatchling', 'cadet', 'explorer', 'veteran']
const reached = (stage: StageId, min: StageId) => ORDER.indexOf(stage) >= ORDER.indexOf(min)

/** What each level multiplies a trip reward by. */
export const LEVEL_MULT: Record<StageId, number> = { egg: 1, hatchling: 1, cadet: 1.25, explorer: 1.5, veteran: 2 }
export const MULT_LEVELS: readonly StageId[] = ['hatchling', 'cadet', 'explorer', 'veteran']
export const fmtMult = (m: number): string => `×${Number(m.toFixed(2))}`

/** The Space Exchange opens at this level (the baseline-learned milestone). */
export const MARKET_MIN_STAGE: StageId = 'cadet'
export const marketOpen = (stage: StageId): boolean => reached(stage, MARKET_MIN_STAGE)

// ── Trips ───────────────────────────────────────────────────────────────────

export interface Route {
  id: string
  name: string
  blurb: string
  hours: number
  /** Round-trip distance in km (real orders of magnitude). */
  km: number
  /** Care points before the level multiplier. */
  base: number
  minStage?: StageId
}

export const ROUTES: readonly Route[] = [
  { id: 'lap', name: 'Orbit lap', blurb: 'Once around the Earth and back for tea.', hours: 1, km: 40_075, base: 3 },
  { id: 'moon', name: 'Moon flyby', blurb: 'Wave at the lander, take a photo, come home.', hours: 4, km: 768_800, base: 14, minStage: 'hatchling' },
  { id: 'mars', name: 'Mars run', blurb: 'A long haul out to the red planet and back.', hours: 8, km: 450_000_000, base: 35, minStage: 'cadet' },
  { id: 'belt', name: 'Asteroid belt tour', blurb: 'Rocks, rocks and more rocks. Pet loves it.', hours: 12, km: 800_000_000, base: 60, minStage: 'explorer' },
  { id: 'jupiter', name: 'Jupiter flyby', blurb: 'Past the great storm. A veteran’s trip.', hours: 24, km: 1_560_000_000, base: 130, minStage: 'veteran' },
]
export const routeById = (id: string): Route | undefined => ROUTES.find((r) => r.id === id)
export const routeOpen = (r: Route, stage: StageId): boolean => !r.minStage || reached(stage, r.minStage)

/** Care points a trip pays at this level (whole points). */
export const payout = (r: Route, stage: StageId): number => Math.round(r.base * LEVEL_MULT[stage])

export type TripState =
  | { kind: 'idle' }
  | { kind: 'away'; route: Route; remainingMs: number; progress: number }
  | { kind: 'back'; route: Route; reward: number }

export function tripState(g: Game, nowMs: number, stage: StageId): TripState {
  const route = g.trip ? routeById(g.trip.route) : undefined
  if (!g.trip || !route) return { kind: 'idle' }
  const total = route.hours * 3.6e6
  const elapsed = Math.max(0, nowMs - g.trip.start)
  if (elapsed >= total) return { kind: 'back', route, reward: payout(route, stage) }
  return { kind: 'away', route, remainingMs: total - elapsed, progress: elapsed / total }
}

export type StartResult = { ok: true; game: Game } | { ok: false; reason: 'busy' | 'unknown' | 'locked' }

export function startTrip(g: Game, routeId: string, nowMs: number, stage: StageId): StartResult {
  const route = routeById(routeId)
  if (!route) return { ok: false, reason: 'unknown' }
  if (g.trip) return { ok: false, reason: 'busy' }
  if (!routeOpen(route, stage)) return { ok: false, reason: 'locked' }
  return { ok: true, game: { ...g, trip: { route: route.id, start: nowMs } } }
}

/** Bring the pet home: adds the reward and the distance. Null while it is still away or idle. */
export function collectTrip(g: Game, nowMs: number, stage: StageId): { game: Game; reward: number; route: Route } | null {
  const s = tripState(g, nowMs, stage)
  if (s.kind !== 'back') return null
  return { game: { ...g, credit: g.credit + s.reward, km: g.km + s.route.km, trips: g.trips + 1, trip: null }, reward: s.reward, route: s.route }
}

export const KM_PER_MILE = 1.609344
export const toMiles = (km: number): number => km / KM_PER_MILE

/** Distances the odometer is measured against (average values, rounded). */
export const LANDMARKS: readonly { km: number; name: string }[] = [
  { km: 40_075, name: 'once around the Earth' },
  { km: 384_400, name: 'the Moon' },
  { km: 149_600_000, name: 'the Sun' },
  { km: 225_000_000, name: 'Mars' },
  { km: 778_500_000, name: 'Jupiter' },
  { km: 4_495_000_000, name: 'Neptune' },
]
/** The next landmark not yet passed, with progress towards it (null when everything is passed). */
export function nextLandmark(km: number): { name: string; km: number; progress: number } | null {
  const next = LANDMARKS.find((l) => km < l.km)
  return next ? { name: next.name, km: next.km, progress: Math.min(1, km / next.km) } : null
}

// ── Space Exchange ──────────────────────────────────────────────────────────

export type TradeResult = { ok: true; game: Game } | { ok: false; reason: 'unknown' | 'locked' | 'poor' | 'shares' | 'none' }

/** Buy shares at the current price. `balance` is the points the crew member has to spend right now. */
export function buyShares(g: Game, id: string, shares: number, nowMs: number, balance: number, stage: StageId): TradeResult {
  const stock = stockById(id)
  if (!stock) return { ok: false, reason: 'unknown' }
  if (!marketOpen(stage)) return { ok: false, reason: 'locked' }
  if (!Number.isInteger(shares) || shares < 1 || shares > 999) return { ok: false, reason: 'shares' }
  const cost = buyCost(priceAt(stock, nowMs), shares)
  if (cost > balance) return { ok: false, reason: 'poor' }
  const held = g.holdings[id] ?? { shares: 0, cost: 0 }
  return { ok: true, game: { ...g, credit: g.credit - cost, holdings: { ...g.holdings, [id]: { shares: held.shares + shares, cost: held.cost + cost } } } }
}

/** Sell shares at the current price. Selling is always allowed, even if the pet's level dropped. */
export function sellShares(g: Game, id: string, shares: number, nowMs: number): TradeResult {
  const stock = stockById(id)
  if (!stock) return { ok: false, reason: 'unknown' }
  const held = g.holdings[id]
  if (!held || held.shares < 1) return { ok: false, reason: 'none' }
  if (!Number.isInteger(shares) || shares < 1 || shares > held.shares) return { ok: false, reason: 'shares' }
  const proceeds = sellValue(priceAt(stock, nowMs), shares)
  const left = held.shares - shares
  const holdings = { ...g.holdings }
  if (left === 0) delete holdings[id]
  else holdings[id] = { shares: left, cost: Math.round(held.cost * (left / held.shares)) }
  return { ok: true, game: { ...g, credit: g.credit + proceeds, holdings } }
}

export interface Position { id: string; shares: number; cost: number; value: number; gain: number }

export function positions(g: Game, nowMs: number): Position[] {
  return Object.entries(g.holdings).flatMap(([id, h]) => {
    const s = stockById(id)
    if (!s) return []
    const value = sellValue(priceAt(s, nowMs), h.shares)
    return [{ id, shares: h.shares, cost: h.cost, value, gain: value - h.cost }]
  })
}

// ── Storage ─────────────────────────────────────────────────────────────────

const num = (x: unknown, min: number): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= min ? x : null)

/** Clean up whatever was in storage: junk and unknown routes or stocks are dropped. */
export function sanitizeGame(raw: unknown): Game {
  if (!raw || typeof raw !== 'object') return EMPTY_GAME
  const r = raw as Record<string, unknown>
  const credit = typeof r.credit === 'number' && Number.isFinite(r.credit) ? Math.round(r.credit) : 0
  let trip: Trip | null = null
  if (r.trip && typeof r.trip === 'object') {
    const t = r.trip as Record<string, unknown>
    const start = num(t.start, 0)
    if (typeof t.route === 'string' && routeById(t.route) && start != null) trip = { route: t.route, start }
  }
  const holdings: Record<string, Holding> = {}
  if (r.holdings && typeof r.holdings === 'object') {
    for (const [id, h] of Object.entries(r.holdings as Record<string, unknown>)) {
      if (!STOCKS.some((s) => s.id === id) || !h || typeof h !== 'object') continue
      const shares = num((h as Record<string, unknown>).shares, 1)
      const cost = num((h as Record<string, unknown>).cost, 0)
      if (shares != null && cost != null && Number.isInteger(shares)) holdings[id] = { shares, cost: Math.round(cost) }
    }
  }
  return { credit, trip, km: num(r.km, 0) ?? 0, trips: Math.floor(num(r.trips, 0) ?? 0), holdings }
}
