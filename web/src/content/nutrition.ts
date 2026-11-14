// Nutrition targets and an on-board pantry. Targets are DEFAULTS meant to be set by the
// crew nutritionist (editable in Settings). Food values are approximate per serving, for
// demonstration — a flight menu would use the mission food database.
//
// Why these nutrients (NASA space-nutrition research, see evidence links):
//  - Energy: crews often eat less than they need in flight → mass and muscle loss.
//  - Protein: supports muscle during unloading (with resistive exercise).
//  - Calcium + vitamin D: bone loses ~1%/month at weight-bearing sites; no sunlight on board.
//  - Sodium: high intake is linked to bone loss and fluid shifts — keep it moderate.
//  - Potassium + fluid: help offset bone/kidney-stone risk and dehydration.

export interface Targets { kcalPerKg: number; proteinPerKg: number; calciumMg: number; vitDug: number; sodiumMaxMg: number; potassiumMg: number; fluidMl: number }
export const DEFAULT_TARGETS: Targets = { kcalPerKg: 35, proteinPerKg: 1.2, calciumMg: 1000, vitDug: 20, sodiumMaxMg: 2300, potassiumMg: 3500, fluidMl: 2500 }

export interface Nutrients { kcal: number; protein: number; calcium: number; sodium: number; potassium: number; fluid: number; vitD: number }
export interface FoodItem { id: string; name: string; serving: string; n: Nutrients; tags: string[] }

const N = (kcal: number, protein: number, calcium: number, sodium: number, potassium: number, fluid = 0, vitD = 0): Nutrients => ({ kcal, protein, calcium, sodium, potassium, fluid, vitD })

export const PANTRY: FoodItem[] = [
  { id: 'eggs', name: 'Scrambled eggs (rehydratable)', serving: '1 pouch', n: N(230, 15, 60, 400, 180, 80, 1.5), tags: ['breakfast', 'protein'] },
  { id: 'oatmeal', name: 'Oatmeal with raisins', serving: '1 pouch', n: N(200, 6, 30, 150, 250, 120), tags: ['breakfast'] },
  { id: 'yogurt', name: 'Yogurt (freeze-dried)', serving: '1 pouch', n: N(150, 10, 300, 100, 400, 100, 1), tags: ['calcium', 'protein'] },
  { id: 'milk', name: 'Milk drink (powder, fortified)', serving: '250 mL', n: N(160, 9, 300, 120, 380, 230, 2.5), tags: ['calcium', 'drink'] },
  { id: 'shake', name: 'Protein shake', serving: '1 pouch', n: N(160, 25, 150, 200, 300, 250, 2.5), tags: ['protein', 'drink'] },
  { id: 'tuna', name: 'Tuna (pouch)', serving: '1 pouch', n: N(120, 25, 15, 350, 250), tags: ['protein'] },
  { id: 'salmon', name: 'Salmon (thermostabilized)', serving: '1 pouch', n: N(200, 22, 20, 450, 400, 0, 10), tags: ['protein', 'vitamin D'] },
  { id: 'brisket', name: 'Beef brisket (thermostabilized)', serving: '1 pouch', n: N(250, 25, 15, 600, 300), tags: ['protein'] },
  { id: 'chicken', name: 'Chicken teriyaki', serving: '1 pouch', n: N(220, 22, 20, 700, 280), tags: ['protein'] },
  { id: 'shrimp', name: 'Shrimp cocktail', serving: '1 pouch', n: N(120, 15, 60, 800, 200), tags: ['protein'] },
  { id: 'lentil', name: 'Lentil curry', serving: '1 pouch', n: N(230, 12, 40, 650, 500, 60), tags: ['protein', 'potassium'] },
  { id: 'macaroni', name: 'Macaroni & cheese', serving: '1 pouch', n: N(350, 14, 250, 750, 150, 60), tags: ['calcium'] },
  { id: 'tortilla', name: 'Tortilla', serving: '1', n: N(150, 4, 50, 350, 70), tags: ['carb'] },
  { id: 'pb', name: 'Peanut butter', serving: '2 tbsp', n: N(190, 7, 15, 140, 200), tags: ['energy'] },
  { id: 'nuts', name: 'Mixed nuts', serving: '30 g', n: N(175, 5, 30, 100, 190), tags: ['energy'] },
  { id: 'apricots', name: 'Dried apricots', serving: '40 g', n: N(100, 1.4, 22, 4, 460), tags: ['potassium', 'fruit'] },
  { id: 'veg', name: 'Spinach & vegetables', serving: '1 pouch', n: N(50, 3, 100, 300, 450, 80), tags: ['potassium', 'vegetable'] },
  { id: 'banana', name: 'Banana (fresh cargo)', serving: '1', n: N(105, 1.3, 6, 1, 420, 90), tags: ['potassium', 'fruit'] },
  { id: 'water', name: 'Water', serving: '250 mL', n: N(0, 0, 0, 0, 0, 250), tags: ['drink'] },
  { id: 'vitd', name: 'Vitamin D supplement', serving: '1 tablet (20 µg)', n: N(0, 0, 0, 0, 0, 0, 20), tags: ['vitamin D'] },
]

export const zero = (): Nutrients => N(0, 0, 0, 0, 0, 0, 0)
export function add(a: Nutrients, b: Nutrients, k = 1): Nutrients {
  return { kcal: a.kcal + b.kcal * k, protein: a.protein + b.protein * k, calcium: a.calcium + b.calcium * k, sodium: a.sodium + b.sodium * k, potassium: a.potassium + b.potassium * k, fluid: a.fluid + b.fluid * k, vitD: a.vitD + b.vitD * k }
}

export function goals(massKg: number, t: Targets) {
  return { kcal: Math.round(t.kcalPerKg * massKg), protein: Math.round(t.proteinPerKg * massKg), calcium: t.calciumMg, sodiumMax: t.sodiumMaxMg, potassium: t.potassiumMg, fluid: t.fluidMl, vitD: t.vitDug }
}

/**
 * Close today's gap: pick up to 3 pantry items, greedily, by how much of the remaining
 * protein / calcium / potassium / fluid gap they fill per kcal, while keeping sodium under
 * the limit and energy under ~110% of target. Deterministic.
 */
export function suggest(eaten: Nutrients, g: ReturnType<typeof goals>, limit = 3): FoodItem[] {
  const picks: FoodItem[] = []
  let cur = { ...eaten }
  for (let k = 0; k < limit; k++) {
    const gap = {
      protein: Math.max(0, g.protein - cur.protein), calcium: Math.max(0, g.calcium - cur.calcium),
      potassium: Math.max(0, g.potassium - cur.potassium), kcal: Math.max(0, g.kcal - cur.kcal),
    }
    if (gap.protein < 5 && gap.calcium < 100 && gap.potassium < 300 && gap.kcal < 150) break
    let best: FoodItem | null = null
    let bestScore = 0
    for (const f of PANTRY) {
      if (picks.includes(f) || f.id === 'water' || f.id === 'vitd') continue
      if (cur.sodium + f.n.sodium > g.sodiumMax) continue
      if (cur.kcal + f.n.kcal > g.kcal * 1.1) continue
      const fill = Math.min(f.n.protein, gap.protein) / Math.max(1, g.protein) * 3 +
        Math.min(f.n.calcium, gap.calcium) / g.calcium + Math.min(f.n.potassium, gap.potassium) / g.potassium +
        Math.min(f.n.kcal, gap.kcal) / Math.max(1, g.kcal)
      const score = fill / Math.max(0.5, f.n.kcal / 200)
      if (score > bestScore) { bestScore = score; best = f }
    }
    if (!best) break
    picks.push(best)
    cur = add(cur, best.n)
  }
  return picks
}
