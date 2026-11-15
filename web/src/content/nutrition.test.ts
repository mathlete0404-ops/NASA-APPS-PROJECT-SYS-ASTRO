import { describe, expect, it } from 'vitest'
import { add, DEFAULT_TARGETS, goals, PANTRY, suggest, zero } from './nutrition'
import { matchMenu, parseFacts, readLabel } from './label'

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
})

describe('space-food menu', () => {
  const f = (id: string) => PANTRY.find((x) => x.id === id)!.n
  it('logged food adds up, portions scale', () => {
    const day = add(add(zero(), f('steak')), f('salmon'), 0.5)
    expect(day.protein).toBe(35)
    expect(day.kcal).toBe(310)
    expect(f('vitd').vitD).toBe(25)
  })
  it('every item has a kind, and no single pouch claims more than 30 g protein', () => {
    for (const x of PANTRY) {
      expect(x.kind).toBeTruthy()
      expect(x.n.protein).toBeLessThanOrEqual(30)
    }
  })
  it('a full day of menu entrées shows the real problem: protein is hard, salt runs high', () => {
    // breakfast eggs + drink, lunch fajitas + tortilla, dinner brisket + potatoes + beans
    const day = ['eggs', 'breakfastdrink', 'fajitas', 'tortilla', 'brisket', 'potatoes', 'greenbeans']
      .reduce((acc, id) => add(acc, f(id)), zero())
    expect(day.protein).toBeLessThan(goals(70, DEFAULT_TARGETS).protein)
    expect(day.sodium).toBeGreaterThan(2300)
  })
  it('suggestions never push sodium over the limit', () => {
    const g = goals(70, DEFAULT_TARGETS)
    const eaten = add(zero(), f('eggs'))
    let cur = eaten
    for (const x of suggest(eaten, g)) cur = add(cur, x.n)
    expect(cur.sodium).toBeLessThanOrEqual(g.sodiumMax)
  })
})

describe('package photo text', () => {
  it('matches an ISS package name, even with OCR noise', () => {
    expect(matchMenu('BEEF BRISKET\nThermostabilized\nNet wt 5.4 oz')?.id).toBe('brisket')
    expect(matchMenu('Mexican Scrambled Eggs | Rehydratable')?.id).toBe('mexeggs')
    expect(matchMenu('Teriyak1 Chicken\nTERIYAKI CHICKEN')?.id).toBe('chicken')
  })
  it('does not guess from one shared word', () => {
    expect(matchMenu('Chicken noodle soup')).toBeNull()
    expect(matchMenu('random text 1234')).toBeNull()
  })
  it('reads a nutrition panel', () => {
    const t = 'Nutrition Facts\nServing size 1 tortilla (49g)\nCalories 150\nTotal Fat 3.5g\nSodium 350mg\nTotal Carbohydrate 25g\nProtein 4g\nVitamin D 0mcg\nCalcium 50mg\nPotassium 70mg'
    expect(parseFacts(t)).toEqual({ kcal: 150, protein: 4, sodium: 350, calcium: 50, potassium: 70, vitD: 0 })
  })
  it('gives a readable title for an unknown product', () => {
    const r = readLabel('Granola Bar\nNutrition Facts\nCalories 190\nProtein 4 g')
    expect(r.item).toBeNull()
    expect(r.title).toBe('Granola Bar')
    expect(r.facts.kcal).toBe(190)
  })
})
