// Per-crew pet wardrobe, kept on this device (same approach as the pet's name and hatch flag).
// A tiny external store so the Today row, the pet page and the shop always show the same look.
import { useCallback, useSyncExternalStore } from 'react'
import { EMPTY_WARDROBE, sanitize, type Wardrobe } from '../engine/petshop'

const key = (crewId: string) => `crew-mirror:pet-wardrobe:${crewId}`
const EVENT = 'crew-mirror:wardrobe'

// useSyncExternalStore needs a stable snapshot, so parsed values are cached by their raw text.
const cache = new Map<string, { raw: string | null; value: Wardrobe }>()

function read(crewId: string): Wardrobe {
  let raw: string | null = null
  try { raw = localStorage.getItem(key(crewId)) } catch { /* private mode */ }
  const hit = cache.get(crewId)
  if (hit && hit.raw === raw) return hit.value
  let value = EMPTY_WARDROBE
  if (raw) { try { value = sanitize(JSON.parse(raw)) } catch { /* corrupt: start fresh */ } }
  cache.set(crewId, { raw, value })
  return value
}

function write(crewId: string, w: Wardrobe) {
  const raw = JSON.stringify(w)
  // Keep an in-memory copy too, so a blocked localStorage still works for this visit.
  cache.set(crewId, { raw, value: w })
  try { localStorage.setItem(key(crewId), raw) } catch { /* private mode: memory only */ }
  window.dispatchEvent(new Event(EVENT))
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', cb) }
}

/** The crew member's wardrobe, plus an updater that takes a pure function (wear, takeOff, ...). */
export function useWardrobe(crewId: string): [Wardrobe, (next: (w: Wardrobe) => Wardrobe) => void] {
  const w = useSyncExternalStore(subscribe, () => read(crewId), () => EMPTY_WARDROBE)
  const update = useCallback((next: (w: Wardrobe) => Wardrobe) => write(crewId, next(read(crewId))), [crewId])
  return [w, update]
}
