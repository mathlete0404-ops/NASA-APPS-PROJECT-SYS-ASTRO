// Solar-storm (solar radiation storm) context from NOAA SWPC GOES integral proton flux.
// NOAA's S-scale is defined on the >=10 MeV integral proton flux in particle flux units (pfu).
// This is context for the crew, not a dosimetry reading: vehicle dosimetry and mission rules win.
import type { Phase } from '../content/mission'

export const SWPC_PROTONS_URL = 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json'

export interface ProtonSample { t: number; flux: number }

export interface StormLevel {
  /** 0 = below S1 (quiet), 1..5 = NOAA S1..S5 */
  scale: 0 | 1 | 2 | 3 | 4 | 5
  label: string
  /** the lower flux bound of this level, pfu */
  floor: number
}

// NOAA Space Weather Scales, radiation storms: S1 >=10, S2 >=1e2, S3 >=1e3, S4 >=1e4, S5 >=1e5 pfu.
const SCALE: StormLevel[] = [
  { scale: 0, label: 'Quiet', floor: 0 },
  { scale: 1, label: 'S1 · Minor', floor: 10 },
  { scale: 2, label: 'S2 · Moderate', floor: 1e2 },
  { scale: 3, label: 'S3 · Strong', floor: 1e3 },
  { scale: 4, label: 'S4 · Severe', floor: 1e4 },
  { scale: 5, label: 'S5 · Extreme', floor: 1e5 },
]

export function stormLevel(flux: number): StormLevel {
  if (!Number.isFinite(flux) || flux < 0) return SCALE[0]
  let out = SCALE[0]
  for (const s of SCALE) if (flux >= s.floor) out = s
  return out
}

interface RawRow { time_tag?: unknown; flux?: unknown; energy?: unknown }

/** Pull the >=10 MeV series out of NOAA's multi-energy JSON. Bad rows are dropped, never guessed. */
export function parseProtons(raw: unknown): ProtonSample[] {
  if (!Array.isArray(raw)) return []
  const out: ProtonSample[] = []
  for (const r of raw as RawRow[]) {
    if (!r || typeof r !== 'object') continue
    if (typeof r.energy !== 'string' || r.energy.replace(/\s/g, '') !== '>=10MeV') continue
    const t = typeof r.time_tag === 'string' ? Date.parse(r.time_tag) : NaN
    const flux = typeof r.flux === 'number' ? r.flux : NaN
    if (!Number.isFinite(t) || !Number.isFinite(flux) || flux < 0) continue
    out.push({ t, flux })
  }
  return out.sort((a, b) => a.t - b.t)
}

export interface SpaceWeather {
  latest: ProtonSample
  /** highest flux in the series (the feed covers the last 24 h) */
  peak: ProtonSample
  now: StormLevel
  peakLevel: StormLevel
  series: ProtonSample[]
  fetchedAt: number
}

export function summarize(series: ProtonSample[], fetchedAt: number): SpaceWeather | null {
  if (series.length === 0) return null
  const latest = series[series.length - 1]
  const peak = series.reduce((m, s) => (s.flux > m.flux ? s : m), series[0])
  return { latest, peak, now: stormLevel(latest.flux), peakLevel: stormLevel(peak.flux), series, fetchedAt }
}

/** A reading older than this is shown as "last known", not as live. */
export const STALE_MS = 45 * 60 * 1000
export const isStale = (w: SpaceWeather, nowMs: number) => nowMs - w.latest.t > STALE_MS

export interface StormAdvice { headline: string; actions: string[]; urgent: boolean }

/** Deterministic advice. In Earth-bound phases the atmosphere and magnetic field already shield the crew. */
export function stormAdvice(level: StormLevel, phase: Phase): StormAdvice {
  if (phase === 'preflight' || phase === 'return') {
    return {
      headline: level.scale >= 1 ? 'Solar storm in progress. No action needed on the ground.' : 'Quiet. No action needed on the ground.',
      actions: ['The atmosphere and magnetic field shield people on the ground. This matters in flight and on the surface.'],
      urgent: false,
    }
  }
  if (level.scale <= 0) return { headline: 'Radiation environment quiet.', actions: ['Follow the normal plan.'], urgent: false }
  if (level.scale === 1) {
    return {
      headline: 'Minor solar radiation storm.',
      actions: ['Normal work can continue.', 'Check the vehicle dosimeter at the next routine check.'],
      urgent: false,
    }
  }
  if (level.scale === 2) {
    return {
      headline: 'Moderate solar radiation storm.',
      actions: [
        'Check the vehicle dosimeter and tell the crew medical officer.',
        'Delay or shorten non-essential EVA until the flux falls.',
      ],
      urgent: false,
    }
  }
  return {
    headline: level.scale === 3 ? 'Strong solar radiation storm.' : 'Severe solar radiation storm.',
    actions: [
      'Go to the best-shielded area, following your mission storm-shelter rules.',
      'Suspend EVA. Crew on the surface return to shelter.',
      'Tell the crew medical officer and log the time you spent in shelter.',
    ],
    urgent: true,
  }
}
