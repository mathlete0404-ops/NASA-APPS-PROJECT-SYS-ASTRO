// Read a food package photo's text (from on-device OCR): match it to the space-food menu
// and/or pull numbers from a nutrition panel. Pure functions; no camera, no network.
import { PANTRY, type FoodItem, type Nutrients } from './nutrition'

export interface LabelRead {
  /** Best menu match, if the package name was readable. */
  item: FoodItem | null
  /** Numbers found on a nutrition panel (per serving), if any. */
  facts: Partial<Nutrients>
  /** The most name-like line, for a custom entry. */
  title: string
}

const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2)

/** Score each menu item by how many of its name words appear on the package. */
export function matchMenu(text: string): FoodItem | null {
  const seen = new Set(words(text))
  let best: FoodItem | null = null
  let bestScore = 0
  for (const f of PANTRY) {
    if (f.id === 'water' || f.id === 'vitd') continue
    const name = words(f.name)
    const nameHits = name.filter((w) => seen.has(w)).length
    const akaHits = (f.aka ?? []).filter((w) => seen.has(w)).length
    // the whole name present counts most; a single shared word (e.g. "chicken") is weak
    const score = (nameHits === name.length ? 3 : 0) + nameHits + akaHits * 0.5
    if (score > bestScore) { bestScore = score; best = f }
  }
  return bestScore >= 3 ? best : null
}

const num = (s: string) => Number(s.replace(',', '.'))
const grab = (text: string, re: RegExp) => { const m = text.match(re); return m ? num(m[1]) : undefined }

/** Numbers from a nutrition-facts panel. Tolerant of OCR noise ("Protein 15g", "Sodium 400 mg"). */
export function parseFacts(text: string): Partial<Nutrients> {
  const t = text.replace(/\r/g, '').replace(/[|]/g, ' ')
  const facts: Partial<Nutrients> = {}
  const kcal = grab(t, /calories\s*[:]?\s*(\d{2,4})/i) ?? grab(t, /(\d{2,4})\s*kcal/i) ?? grab(t, /energy[^\d\n]{0,12}(\d{2,4})\s*kcal/i)
  const protein = grab(t, /protein\s*[:]?\s*(\d{1,3}(?:[.,]\d)?)\s*g/i)
  const sodium = grab(t, /sodium\s*[:]?\s*(\d{1,4})\s*mg/i)
  const calcium = grab(t, /calcium\s*[:]?\s*(\d{1,4})\s*mg/i)
  const potassium = grab(t, /potassium\s*[:]?\s*(\d{1,4})\s*mg/i)
  const vitD = grab(t, /vitamin\s*d\s*[:]?\s*(\d{1,3}(?:[.,]\d)?)\s*(?:mcg|µg|ug)/i)
  if (kcal !== undefined && kcal < 2000) facts.kcal = kcal
  if (protein !== undefined && protein < 150) facts.protein = protein
  if (sodium !== undefined) facts.sodium = sodium
  if (calcium !== undefined) facts.calcium = calcium
  if (potassium !== undefined) facts.potassium = potassium
  if (vitD !== undefined && vitD < 100) facts.vitD = vitD
  return facts
}

/** The first line that looks like a product name (letters, not a nutrition row). */
export function titleLine(text: string): string {
  const skip = /nutrition|facts|serving|calories|amount|daily value|protein|sodium|fat|carbohydrate|ingredients|net wt|^\W*$/i
  for (const raw of text.split('\n')) {
    const l = raw.replace(/[^A-Za-z0-9&'\-\s]/g, ' ').replace(/\s+/g, ' ').trim()
    if (l.length >= 4 && /[a-z]{3}/i.test(l) && !skip.test(l)) return l.slice(0, 40)
  }
  return ''
}

export function readLabel(text: string): LabelRead {
  return { item: matchMenu(text), facts: parseFacts(text), title: titleLine(text) }
}
