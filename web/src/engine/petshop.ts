// Pet shop: cosmetic accessories for the crew pet, paid for with care points.
//
// Design rules (same spirit as engine/pet.ts, do not change without a team decision):
// - Cosmetic only. Nothing here changes a status, a result, a plan or the pet's growth.
// - Care points come from showing up (pet.xp: daily check, exercise, food log, pain report),
//   never from health results, so nobody is rewarded for looking healthy or hiding symptoms.
// - No real money, no timers, no limited stock, no streak pressure. Items are never lost,
//   and a missed day never takes anything away.
// - Spending never lowers the pet's stage or mood: those come from check days, not from points.
// Pure logic: no store, no DOM, no clock.
import type { StageId } from './pet'

export type Slot = 'head' | 'face' | 'back' | 'scene'

export const SLOTS: readonly { id: Slot; label: string; one: string }[] = [
  { id: 'head', label: 'Hats', one: 'hat' },
  { id: 'face', label: 'Faces', one: 'face accessory' },
  { id: 'back', label: 'Backs', one: 'back accessory' },
  { id: 'scene', label: 'Scenes', one: 'scene' },
]

export interface ShopItem {
  id: string
  slot: Slot
  name: string
  blurb: string
  /** Care points. */
  price: number
  /** Earliest pet stage that can wear it (a quiet milestone, never a time limit). */
  minStage?: StageId
}

export const ITEMS: readonly ShopItem[] = [
  // Hats
  { id: 'beanie', slot: 'head', name: 'Cozy beanie', blurb: 'Warm for the long nights between stars.', price: 18 },
  { id: 'headphones', slot: 'head', name: 'Headphones', blurb: 'For the playlist that gets you through a long shift.', price: 30 },
  { id: 'captain', slot: 'head', name: 'Captain’s cap', blurb: 'Flat cap with a gold star. Very official.', price: 40 },
  { id: 'crown', slot: 'head', name: 'Gold crown', blurb: 'For a pet that has been around a while.', price: 120, minStage: 'explorer' },
  // Faces
  { id: 'glasses', slot: 'face', name: 'Round glasses', blurb: 'Reads the checklist twice.', price: 15 },
  { id: 'hearts', slot: 'face', name: 'Heart specs', blurb: 'Sees everything in a good light.', price: 20 },
  { id: 'visor', slot: 'face', name: 'Sun visor', blurb: 'Handy near the big window.', price: 45, minStage: 'cadet' },
  // Backs
  { id: 'cape', slot: 'back', name: 'Mission cape', blurb: 'Floats nicely when nothing pulls it down.', price: 25 },
  { id: 'wings', slot: 'back', name: 'Moth wings', blurb: 'Soft, a little silly, completely weightless.', price: 75, minStage: 'explorer' },
  // Scenes (what is behind the pet inside the helmet glass)
  { id: 'stars', slot: 'scene', name: 'Starfield', blurb: 'A quiet patch of deep space.', price: 12 },
  { id: 'moon', slot: 'scene', name: 'Crescent moon', blurb: 'The view from a long-haul window.', price: 30 },
  { id: 'planet', slot: 'scene', name: 'Ringed planet', blurb: 'A gas giant drifting past.', price: 40 },
  { id: 'aurora', slot: 'scene', name: 'Aurora', blurb: 'Green and violet curtains of light.', price: 70, minStage: 'cadet' },
]

export const itemById = (id: string): ShopItem | undefined => ITEMS.find((i) => i.id === id)

export interface Wardrobe {
  owned: string[]
  worn: Partial<Record<Slot, string>>
  /** Care points spent so far. */
  spent: number
}

export const EMPTY_WARDROBE: Wardrobe = { owned: [], worn: {}, spent: 0 }

const STAGE_ORDER: StageId[] = ['egg', 'hatchling', 'cadet', 'explorer', 'veteran']
export const stageName = (id: StageId): string => id.charAt(0).toUpperCase() + id.slice(1)
const reached = (stage: StageId, min: StageId) => STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(min)

/** Points left to spend. Never negative: clearing app data can lower xp, but never takes items away. */
export const balance = (xp: number, w: Wardrobe): number => Math.max(0, Math.floor(xp) - w.spent)

export type Availability = 'worn' | 'owned' | 'buy' | 'poor' | 'locked'

/** What the shop should offer for one item right now. */
export function availability(item: ShopItem, w: Wardrobe, xp: number, stage: StageId): Availability {
  if (w.owned.includes(item.id)) return w.worn[item.slot] === item.id ? 'worn' : 'owned'
  if (item.minStage && !reached(stage, item.minStage)) return 'locked'
  return balance(xp, w) >= item.price ? 'buy' : 'poor'
}

export type BuyResult = { ok: true; wardrobe: Wardrobe } | { ok: false; reason: 'unknown' | 'owned' | 'locked' | 'poor' }

/** Buy an item and put it on. Pure: returns the new wardrobe or the reason it was refused. */
export function buy(w: Wardrobe, itemId: string, xp: number, stage: StageId): BuyResult {
  const item = itemById(itemId)
  if (!item) return { ok: false, reason: 'unknown' }
  const a = availability(item, w, xp, stage)
  if (a === 'worn' || a === 'owned') return { ok: false, reason: 'owned' }
  if (a === 'locked') return { ok: false, reason: 'locked' }
  if (a === 'poor') return { ok: false, reason: 'poor' }
  return { ok: true, wardrobe: { owned: [...w.owned, item.id], worn: { ...w.worn, [item.slot]: item.id }, spent: w.spent + item.price } }
}

/** Put on something you own. Replaces whatever is worn in that slot. */
export function wear(w: Wardrobe, itemId: string): Wardrobe {
  const item = itemById(itemId)
  if (!item || !w.owned.includes(item.id)) return w
  return { ...w, worn: { ...w.worn, [item.slot]: item.id } }
}

export function takeOff(w: Wardrobe, slot: Slot): Wardrobe {
  if (!w.worn[slot]) return w
  const worn = { ...w.worn }
  delete worn[slot]
  return { ...w, worn }
}

/** Clean up whatever was in storage: unknown items, duplicates and worn-but-not-owned entries are dropped. */
export function sanitize(raw: unknown): Wardrobe {
  if (!raw || typeof raw !== 'object') return EMPTY_WARDROBE
  const r = raw as { owned?: unknown; worn?: unknown; spent?: unknown }
  const owned = Array.isArray(r.owned) ? [...new Set(r.owned.filter((x): x is string => typeof x === 'string' && !!itemById(x)))] : []
  const worn: Partial<Record<Slot, string>> = {}
  if (r.worn && typeof r.worn === 'object') {
    for (const [slot, id] of Object.entries(r.worn as Record<string, unknown>)) {
      const item = typeof id === 'string' ? itemById(id) : undefined
      if (item && item.slot === slot && owned.includes(item.id)) worn[item.slot] = item.id
    }
  }
  const spent = typeof r.spent === 'number' && Number.isFinite(r.spent) && r.spent > 0 ? Math.floor(r.spent) : 0
  return { owned, worn, spent }
}

/** The look to draw: what is worn, with an optional "try on" item shown in its slot. */
export function outfit(w: Wardrobe, tryOn?: string | null): Partial<Record<Slot, string>> {
  const t = tryOn ? itemById(tryOn) : undefined
  return t ? { ...w.worn, [t.slot]: t.id } : { ...w.worn }
}
