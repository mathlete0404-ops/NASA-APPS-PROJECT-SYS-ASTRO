// Alertness test: a Psychomotor Vigilance Test in the PVT-B style (ported from the team's first prototype).
// A counter starts at random 1-4 s intervals and you press as soon as you see it. Slow responses
// (lapses) and the median reaction time are standard fatigue measures in sleep research.
//
// It is a pattern, not a diagnosis, and it is compared with the crew member's OWN baseline like every
// other measure. A test with too few valid responses, or mostly early presses, is "No data", never "Fine".
// Pure logic: no DOM, no clock, no randomness unless passed in.

/** Reaction time at or above this is a lapse (PVT-B convention). */
export const LAPSE_MS = 355
/** A response sooner than this is an anticipation (a guess), not a reaction. */
export const FALSE_START_MS = 100
/** No response by now: counted as a lapse of this length and the trial ends. */
export const TIMEOUT_MS = 10_000
/** Fewer valid responses than this and the test is "No data". */
export const MIN_TRIALS = 5
/** More early presses than this share of all presses and the test is "No data". */
export const MAX_FALSE_START_SHARE = 0.4

export const DURATIONS: readonly { seconds: number; label: string; note: string }[] = [
  { seconds: 60, label: '1 minute', note: 'Quick check. About 15 responses.' },
  { seconds: 180, label: '3 minutes', note: 'Standard length. About 45 responses, a steadier number.' },
]

/** Wait before the next counter starts: 1 to 4 s from a random number in [0,1). */
export const nextWaitMs = (rand: number): number => 1000 + Math.min(0.999999, Math.max(0, rand)) * 3000

export interface PvtTrials {
  /** Valid reaction times in ms (timeouts are recorded as TIMEOUT_MS). */
  rts: number[]
  /** Presses before the counter started, or sooner than FALSE_START_MS after it. */
  falseStarts: number
}

export interface PvtResult {
  /** Responses counted (valid + early presses). */
  n: number
  valid: number
  medianRT: number
  meanRT: number
  /** Mean of the fastest 10% of responses. */
  fastest10: number
  /** Mean of the slowest 10% of responses. */
  slowest10: number
  lapses: number
  falseStarts: number
  /** Lapses as a share of valid responses, in percent. This is the number tracked against your baseline. */
  lapsePct: number
  /** 0-100: share of responses that were neither lapses nor early presses. */
  score: number
  ok: boolean
  /** Why a result is "No data", or a short reading note. */
  note: string
}

const med = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

export function summarize(t: PvtTrials): PvtResult {
  const rts = t.rts.filter((r) => Number.isFinite(r) && r >= FALSE_START_MS)
  const tooFast = t.rts.filter((r) => Number.isFinite(r) && r < FALSE_START_MS).length // an early press that slipped into the list
  const early = t.falseStarts + tooFast
  const n = rts.length + early
  const empty = { medianRT: 0, meanRT: 0, fastest10: 0, slowest10: 0, lapses: 0, lapsePct: 0, score: 0 }
  if (rts.length < MIN_TRIALS) {
    return { n, valid: rts.length, falseStarts: early, ...empty, ok: false, note: `Only ${rts.length} valid responses (need ${MIN_TRIALS}). Try again and press as soon as the counter starts.` }
  }
  if (early / n > MAX_FALSE_START_SHARE) {
    return { n, valid: rts.length, falseStarts: early, ...empty, ok: false, note: `${early} of ${n} presses were too early, so the reaction times are not reliable. Wait for the counter.` }
  }
  const sorted = [...rts].sort((a, b) => a - b)
  const k = Math.max(1, Math.round(sorted.length * 0.1))
  const lapses = sorted.filter((r) => r >= LAPSE_MS).length
  return {
    n,
    valid: rts.length,
    medianRT: Math.round(med(rts)),
    meanRT: Math.round(mean(rts)),
    fastest10: Math.round(mean(sorted.slice(0, k))),
    slowest10: Math.round(mean(sorted.slice(-k))),
    lapses,
    falseStarts: early,
    lapsePct: Math.round((lapses / rts.length) * 1000) / 10,
    score: Math.round((1 - (lapses + early) / n) * 100),
    ok: true,
    note: lapses === 0 ? 'No lapses.' : `${lapses} slow response${lapses === 1 ? '' : 's'} (${LAPSE_MS} ms or more).`,
  }
}
