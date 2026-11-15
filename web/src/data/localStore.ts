// Tiny per-crew store kept in localStorage, shared by the pet's wardrobe and its trips and market.
// It is a proper external store, so every screen that shows the pet always shows the same state.
import { useCallback, useSyncExternalStore } from 'react'

export function createCrewStore<T>(prefix: string, empty: T, sanitize: (raw: unknown) => T) {
  const key = (crewId: string) => `${prefix}:${crewId}`
  const event = `${prefix}:changed`
  // useSyncExternalStore needs a stable snapshot, so parsed values are cached by their raw text.
  const cache = new Map<string, { raw: string | null; value: T }>()

  function read(crewId: string): T {
    let raw: string | null = null
    try { raw = localStorage.getItem(key(crewId)) } catch { /* private mode */ }
    const hit = cache.get(crewId)
    if (hit && (hit.raw === raw || raw === null)) return hit.value // raw null + memory copy = storage blocked
    let value = empty
    if (raw) { try { value = sanitize(JSON.parse(raw)) } catch { /* corrupt: start fresh */ } }
    cache.set(crewId, { raw, value })
    return value
  }

  function write(crewId: string, v: T) {
    const raw = JSON.stringify(v)
    // Keep an in-memory copy too, so a blocked localStorage still works for this visit.
    cache.set(crewId, { raw, value: v })
    try { localStorage.setItem(key(crewId), raw) } catch { /* memory only */ }
    window.dispatchEvent(new Event(event))
  }

  const subscribe = (cb: () => void) => {
    window.addEventListener(event, cb)
    window.addEventListener('storage', cb)
    return () => { window.removeEventListener(event, cb); window.removeEventListener('storage', cb) }
  }

  /** The crew member's saved value, plus an updater that takes a pure function. */
  return function useCrewStore(crewId: string): [T, (next: (v: T) => T) => void] {
    const v = useSyncExternalStore(subscribe, () => read(crewId), () => empty)
    const update = useCallback((next: (v: T) => T) => write(crewId, next(read(crewId))), [crewId])
    return [v, update]
  }
}
