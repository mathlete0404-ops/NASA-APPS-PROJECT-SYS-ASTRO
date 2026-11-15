// Nutrition targets and an on-board space-food menu. Targets are DEFAULTS meant to be set by
// the crew nutritionist (editable in Settings). Food values are estimates per serving (see
// PANTRY) — a flight menu would use the mission food database.
//
// Defaults follow NASA's exploration nutrition requirements, JSC-67378 (2020), written for a
// 70-kg crewmember: protein 1.2-1.8 g/kg, calcium 1000-1200 mg, vitamin D 25 ug (1000 IU),
// sodium 1500-2300 mg, potassium 3400 mg (men) / 2600 mg (women), fluid 32 mL/kg and at least
// 2500 mL (men) / 2100 mL (women). Energy uses the DRI estimated-energy equation in JSC-67378;
// ~35 kcal/kg is a close stand-in for a 70-kg adult until the nutritionist sets it.
//
// Why these nutrients (NASA space-nutrition research, see evidence links):
//  - Energy: crews often eat less than they need in flight → mass and muscle loss.
//  - Protein: supports muscle during unloading (with resistive exercise).
//  - Calcium + vitamin D: bone loses ~1%/month at weight-bearing sites; no sunlight on board.
//  - Sodium: high intake is linked to bone loss and fluid shifts — keep it moderate.
//  - Potassium + fluid: help offset bone/kidney-stone risk and dehydration.

export interface Targets { kcalPerKg: number; proteinPerKg: number; calciumMg: number; vitDug: number; sodiumMaxMg: number; potassiumMg: number; fluidMlPerKg: number; fluidMl: number }
export const DEFAULT_TARGETS: Targets = { kcalPerKg: 35, proteinPerKg: 1.2, calciumMg: 1000, vitDug: 25, sodiumMaxMg: 2300, potassiumMg: 3400, fluidMlPerKg: 32, fluidMl: 2500 }

export interface Nutrients { kcal: number; protein: number; calcium: number; sodium: number; potassium: number; fluid: number; vitD: number }
/** How the food is kept on board (NASA Space Food Systems categories). */
export type FoodKind = 'Thermostabilized' | 'Rehydratable' | 'Irradiated' | 'Natural form' | 'Fresh (resupply)' | 'Drink' | 'Supplement'
export interface FoodItem { id: string; name: string; serving: string; kind: FoodKind; n: Nutrients; tags: string[]; /** extra words printed on packages, for photo matching */ aka?: string[] }

const N = (kcal: number, protein: number, calcium: number, sodium: number, potassium: number, fluid = 0, vitD = 0): Nutrients => ({ kcal, protein, calcium, sodium, potassium, fluid, vitD })

// Space food is shelf-stable: pouches heated (thermostabilized), water added (rehydratable),
// irradiated meat, nuts and tortillas as they are (natural form), and a little fresh food when
// a cargo ship arrives. Item names follow the ISS menu. Values are ESTIMATES per serving from
// comparable foods (USDA FoodData Central), deliberately conservative on protein; a mission
// would load the crew food database instead. Protein is harder to reach than on Earth and
// salt runs higher: ISS crews ate ~96-109 g protein and ~3,800-4,700 mg sodium a day
// (NASA OCHMO-TB-013 Food and Nutrition), and NASA reformulated 90+ foods to cut menu sodium.
export const PANTRY: FoodItem[] = [
  { id: 'eggs', name: 'Scrambled eggs', serving: '1 pouch', kind: 'Rehydratable', n: N(190, 12, 60, 380, 150, 70, 1.2), tags: ['breakfast', 'protein'], aka: ['egg', 'eggs', 'scrambled'] },
  { id: 'mexeggs', name: 'Mexican scrambled eggs', serving: '1 pouch', kind: 'Rehydratable', n: N(200, 12, 60, 520, 170, 70, 1.2), tags: ['breakfast', 'protein'], aka: ['mexican', 'egg'] },
  { id: 'oatmeal', name: 'Oatmeal with brown sugar', serving: '1 pouch', kind: 'Rehydratable', n: N(170, 5, 20, 150, 150, 110), tags: ['breakfast'], aka: ['oatmeal', 'oat'] },
  { id: 'breakfastdrink', name: 'Instant breakfast drink', serving: '1 pouch', kind: 'Drink', n: N(220, 10, 350, 200, 450, 240, 2.5), tags: ['breakfast', 'calcium', 'drink'], aka: ['instant', 'breakfast', 'drink'] },
  { id: 'brisket', name: 'Beef brisket', serving: '1 pouch', kind: 'Thermostabilized', n: N(200, 22, 15, 550, 280), tags: ['protein'], aka: ['beef', 'brisket'] },
  { id: 'steak', name: 'Beef steak', serving: '1 pouch', kind: 'Irradiated', n: N(230, 26, 15, 400, 320), tags: ['protein'], aka: ['beef', 'steak'] },
  { id: 'chicken', name: 'Teriyaki chicken', serving: '1 pouch', kind: 'Thermostabilized', n: N(210, 20, 20, 700, 260), tags: ['protein'], aka: ['teriyaki', 'chicken'] },
  { id: 'fajitas', name: 'Chicken fajitas', serving: '1 pouch', kind: 'Thermostabilized', n: N(160, 14, 40, 500, 300), tags: ['protein'], aka: ['fajita', 'fajitas', 'chicken'] },
  { id: 'tuna', name: 'Tuna salad spread', serving: '1 pouch', kind: 'Thermostabilized', n: N(160, 11, 15, 330, 150), tags: ['protein'], aka: ['tuna', 'salad', 'spread'] },
  { id: 'salmon', name: 'Salmon', serving: '1 pouch', kind: 'Thermostabilized', n: N(160, 18, 150, 400, 300, 0, 8), tags: ['protein', 'vitamin D', 'calcium'], aka: ['salmon'] },
  { id: 'shrimp', name: 'Shrimp cocktail', serving: '1 pouch', kind: 'Rehydratable', n: N(110, 12, 50, 800, 200, 60), tags: ['protein'], aka: ['shrimp', 'cocktail'] },
  { id: 'macaroni', name: 'Macaroni and cheese', serving: '1 pouch', kind: 'Rehydratable', n: N(300, 12, 200, 650, 150, 60), tags: ['calcium'], aka: ['macaroni', 'cheese', 'mac'] },
  { id: 'potatoes', name: 'Mashed potatoes', serving: '1 pouch', kind: 'Rehydratable', n: N(160, 4, 40, 450, 450, 90), tags: ['potassium'], aka: ['mashed', 'potatoes', 'potato'] },
  { id: 'greenbeans', name: 'Green beans with mushrooms', serving: '1 pouch', kind: 'Thermostabilized', n: N(60, 2, 40, 350, 200, 60), tags: ['vegetable'], aka: ['green', 'beans', 'mushrooms'] },
  { id: 'pudding', name: 'Vanilla pudding', serving: '1 pouch', kind: 'Thermostabilized', n: N(140, 3, 100, 160, 140, 60), tags: ['calcium'], aka: ['vanilla', 'pudding'] },
  { id: 'tortilla', name: 'Tortilla', serving: '1', kind: 'Natural form', n: N(150, 4, 50, 350, 70), tags: ['carb'], aka: ['tortilla', 'tortillas'] },
  { id: 'pb', name: 'Peanut butter', serving: '2 tbsp', kind: 'Natural form', n: N(190, 7, 15, 140, 200), tags: ['energy'], aka: ['peanut', 'butter'] },
  { id: 'cashews', name: 'Cashews', serving: '30 g', kind: 'Natural form', n: N(165, 5, 10, 90, 190), tags: ['energy'], aka: ['cashews', 'cashew', 'nuts'] },
  { id: 'apricots', name: 'Dried apricots', serving: '40 g', kind: 'Natural form', n: N(100, 1.4, 22, 4, 460), tags: ['potassium', 'fruit'], aka: ['dried', 'apricots', 'apricot'] },
  { id: 'fruit', name: 'Fresh apple or orange', serving: '1', kind: 'Fresh (resupply)', n: N(80, 1, 50, 1, 230, 120), tags: ['potassium', 'fruit'], aka: ['apple', 'orange', 'fresh'] },
  { id: 'water', name: 'Water', serving: '250 mL', kind: 'Drink', n: N(0, 0, 0, 0, 0, 250), tags: ['drink'] },
  { id: 'vitd', name: 'Vitamin D supplement', serving: '1 tablet (25 µg, 1000 IU)', kind: 'Supplement', n: N(0, 0, 0, 0, 0, 0, 25), tags: ['vitamin D'] },
]
export const FOOD_KINDS: FoodKind[] = ['Thermostabilized', 'Rehydratable', 'Irradiated', 'Natural form', 'Fresh (resupply)', 'Drink', 'Supplement']
/** How much of the serving was eaten (as NASA's ISS food tracker asks). */
export const PORTIONS = [1, 0.75, 0.5, 0.25] as const
export const portionLabel = (k: number) => (k === 1 ? 'All' : k === 0.75 ? '¾' : k === 0.5 ? '½' : k === 0.25 ? '¼' : `${k}×`)

export const zero = (): Nutrients => N(0, 0, 0, 0, 0, 0, 0)
export function add(a: Nutrients, b: Nutrients, k = 1): Nutrients {
  return { kcal: a.kcal + b.kcal * k, protein: a.protein + b.protein * k, calcium: a.calcium + b.calcium * k, sodium: a.sodium + b.sodium * k, potassium: a.potassium + b.potassium * k, fluid: a.fluid + b.fluid * k, vitD: a.vitD + b.vitD * k }
}

export function goals(massKg: number, t: Targets) {
  return { kcal: Math.round(t.kcalPerKg * massKg), protein: Math.round(t.proteinPerKg * massKg), calcium: t.calciumMg, sodiumMax: t.sodiumMaxMg, potassium: t.potassiumMg, fluid: Math.max(Math.round((t.fluidMlPerKg ?? 32) * massKg / 50) * 50, t.fluidMl), vitD: t.vitDug }
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
