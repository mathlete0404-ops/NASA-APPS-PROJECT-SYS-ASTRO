import { describe, expect, it } from 'vitest'
import { add, DEFAULT_TARGETS, goals, PANTRY, zero } from './nutrition'

// Defaults must match NASA's exploration nutrition requirements, JSC-67378 (2020).
describe('nutrition targets (NASA JSC-67378)', () => {
  it('protein is 1.2 g per kg body mass (lower end of 1.2-1.8)', () => {
    expect(goals(70, DEFAULT_TARGETS).protein).toBe(84)
    expect(goals(90, DEFAULT_TARGETS).protein).toBe(108)
  })
  it('fluid is 32 mL/kg, never below 2500 mL', () => {
    expect(goals(70, DEFAULT_TARGETS).fluid).toBe(2500)
    expect(goals(90, DEFAULT_TARGETS).fluid).toBe(2900)
  })
  it('vitamin D 25 ug, calcium 1000 mg, sodium max 2300 mg, potassium 3400 mg', () => {
    const g = goals(70, DEFAULT_TARGETS)
    expect([g.vitD, g.calcium, g.sodiumMax, g.potassium]).toEqual([25, 1000, 2300, 3400])
  })
  it('logged food adds up', () => {
    const f = (id: string) => PANTRY.find((x) => x.id === id)!.n
    const day = add(add(zero(), f('tuna')), f('shake'))
    expect(day.protein).toBe(50)
    expect(day.kcal).toBe(280)
    expect(f('vitd').vitD).toBe(25)
  })
})
