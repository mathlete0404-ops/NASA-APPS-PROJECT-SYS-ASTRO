import { describe, expect, it } from 'vitest'
import { STAGES } from './pet'
import { ART } from '../components/PetAccessories'
import { availability, balance, buy, EMPTY_WARDROBE, ITEMS, itemById, outfit, sanitize, SLOTS, takeOff, wear, type Wardrobe } from './petshop'

const own = (ids: string[], spent = 0): Wardrobe => {
  const worn: Wardrobe['worn'] = {}
  for (const id of ids) { const it = itemById(id)!; worn[it.slot] = id }
  return { owned: ids, worn, spent }
}

describe('catalog', () => {
  it('has unique ids, known slots, whole positive prices and real stages', () => {
    const ids = new Set<string>()
    const stages = new Set(STAGES.map((s) => s.id as string))
    for (const i of ITEMS) {
      expect(ids.has(i.id), i.id).toBe(false)
      ids.add(i.id)
      expect(SLOTS.some((s) => s.id === i.slot), i.id).toBe(true)
      expect(Number.isInteger(i.price) && i.price > 0, i.id).toBe(true)
      if (i.minStage) expect(stages.has(i.minStage), i.id).toBe(true)
      expect(i.name.length).toBeGreaterThan(2)
    }
  })
  it('has artwork for every item and no artwork without an item', () => {
    expect(Object.keys(ART).sort()).toEqual(ITEMS.map((i) => i.id).sort())
  })
  it('has something every slot can buy with a few days of care points (a full care day is 18)', () => {
    for (const s of SLOTS) expect(ITEMS.some((i) => i.slot === s.id && !i.minStage && i.price <= 25), s.id).toBe(true)
  })
  it('keeps names free of agency branding', () => {
    for (const i of ITEMS) expect(`${i.name} ${i.blurb}`).not.toMatch(/nasa/i)
  })
})

describe('balance', () => {
  it('is points earned minus points spent', () => {
    expect(balance(100, { ...EMPTY_WARDROBE, spent: 30 })).toBe(70)
  })
  it('never goes below zero, even if app data was cleared and xp dropped', () => {
    expect(balance(10, { ...EMPTY_WARDROBE, spent: 80 })).toBe(0)
    expect(balance(-5, EMPTY_WARDROBE)).toBe(0)
  })
})

describe('availability', () => {
  const crown = itemById('crown')!
  const beanie = itemById('beanie')!
  it('buy when affordable, poor when not', () => {
    expect(availability(beanie, EMPTY_WARDROBE, 18, 'hatchling')).toBe('buy')
    expect(availability(beanie, EMPTY_WARDROBE, 17, 'hatchling')).toBe('poor')
  })
  it('locked until the stage is reached, however many points you have', () => {
    expect(availability(crown, EMPTY_WARDROBE, 9999, 'cadet')).toBe('locked')
    expect(availability(crown, EMPTY_WARDROBE, 9999, 'explorer')).toBe('buy')
    expect(availability(crown, EMPTY_WARDROBE, 9999, 'veteran')).toBe('buy')
  })
  it('owned items stay available and show worn vs owned', () => {
    expect(availability(beanie, own(['beanie']), 0, 'hatchling')).toBe('worn')
    expect(availability(beanie, { owned: ['beanie'], worn: {}, spent: 18 }, 0, 'hatchling')).toBe('owned')
  })
  it('an owned item is never taken away if the stage later drops (data cleared)', () => {
    expect(availability(crown, own(['crown'], 120), 0, 'egg')).toBe('worn')
  })
})

describe('buy', () => {
  it('spends the price, owns the item and puts it on', () => {
    const r = buy(EMPTY_WARDROBE, 'glasses', 50, 'hatchling')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.wardrobe.spent).toBe(15)
      expect(r.wardrobe.owned).toEqual(['glasses'])
      expect(r.wardrobe.worn.face).toBe('glasses')
    }
  })
  it('refuses when poor, locked, already owned or unknown, and changes nothing', () => {
    expect(buy(EMPTY_WARDROBE, 'glasses', 14, 'hatchling')).toEqual({ ok: false, reason: 'poor' })
    expect(buy(EMPTY_WARDROBE, 'crown', 999, 'cadet')).toEqual({ ok: false, reason: 'locked' })
    expect(buy(own(['glasses'], 15), 'glasses', 999, 'cadet')).toEqual({ ok: false, reason: 'owned' })
    expect(buy(EMPTY_WARDROBE, 'jetpack', 999, 'cadet')).toEqual({ ok: false, reason: 'unknown' })
  })
  it('does not let you spend the same points twice', () => {
    const first = buy(EMPTY_WARDROBE, 'beanie', 30, 'hatchling')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    // 30 earned, 18 spent: 12 left, so a 15-point item is out of reach
    expect(buy(first.wardrobe, 'glasses', 30, 'hatchling')).toEqual({ ok: false, reason: 'poor' })
  })
  it('buying a second hat replaces the worn one but keeps both', () => {
    const a = buy(EMPTY_WARDROBE, 'beanie', 100, 'cadet')
    if (!a.ok) throw new Error('setup')
    const b = buy(a.wardrobe, 'headphones', 100, 'cadet')
    expect(b.ok).toBe(true)
    if (b.ok) {
      expect(b.wardrobe.worn.head).toBe('headphones')
      expect(b.wardrobe.owned).toEqual(['beanie', 'headphones'])
    }
  })
})

describe('wear / takeOff', () => {
  it('only wears what you own, replacing the slot', () => {
    const w = { owned: ['beanie', 'captain'], worn: { head: 'beanie' }, spent: 58 }
    expect(wear(w, 'captain').worn.head).toBe('captain')
    expect(wear(w, 'crown')).toBe(w)
    expect(wear(w, 'nope')).toBe(w)
  })
  it('takes off a slot without losing the item', () => {
    const w = takeOff(own(['beanie'], 18), 'head')
    expect(w.worn.head).toBeUndefined()
    expect(w.owned).toEqual(['beanie'])
    expect(takeOff(w, 'head')).toBe(w)
  })
})

describe('sanitize', () => {
  it('returns an empty wardrobe for junk', () => {
    expect(sanitize(null)).toEqual(EMPTY_WARDROBE)
    expect(sanitize('x')).toEqual(EMPTY_WARDROBE)
    expect(sanitize(42)).toEqual(EMPTY_WARDROBE)
  })
  it('drops unknown and duplicate items, and worn items that are not owned or in the wrong slot', () => {
    const w = sanitize({ owned: ['beanie', 'beanie', 'jetpack', 7], worn: { head: 'beanie', face: 'beanie', back: 'cape', scene: 5 }, spent: 18.9 })
    expect(w.owned).toEqual(['beanie'])
    expect(w.worn).toEqual({ head: 'beanie' })
    expect(w.spent).toBe(18)
  })
  it('clamps bad spent values to zero', () => {
    expect(sanitize({ owned: [], worn: {}, spent: -5 }).spent).toBe(0)
    expect(sanitize({ owned: [], worn: {}, spent: NaN }).spent).toBe(0)
    expect(sanitize({ owned: [], worn: {}, spent: '20' }).spent).toBe(0)
  })
})

describe('outfit', () => {
  it('shows a try-on item in its slot without changing what is owned or worn', () => {
    const w = own(['beanie'], 18)
    expect(outfit(w, 'crown')).toEqual({ head: 'crown' })
    expect(outfit(w, 'glasses')).toEqual({ head: 'beanie', face: 'glasses' })
    expect(outfit(w, null)).toEqual({ head: 'beanie' })
    expect(w.worn).toEqual({ head: 'beanie' })
  })
})
