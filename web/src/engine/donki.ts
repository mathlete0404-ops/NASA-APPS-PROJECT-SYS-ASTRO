// Solar events from NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information, NASA CCMC):
// flares (FLR), solar energetic particle events (SEP) and geomagnetic storms (GST). Ported from the
// team's first prototype and made phase-aware. It complements the live NOAA proton flux in
// engine/spaceweather.ts: this is what the Sun did in the last days, that is what the radiation is now.
//
// Context for the crew, not dosimetry: vehicle dosimetry and mission radiation rules always come first.
// Pure logic: no DOM, the clock is always passed in.
import type { Phase } from '../content/mission'

const H = 3.6e6

export const DONKI_KINDS = ['FLR', 'SEP', 'GST'] as const
export type DonkiKind = (typeof DONKI_KINDS)[number]

/** NASA's API gateway first (public DEMO_KEY, rate limited), then the DONKI service itself. */
export function donkiUrls(kind: DonkiKind, startISO: string, endISO: string, apiKey = 'DEMO_KEY'): string[] {
  return [
    `https://api.nasa.gov/DONKI/${kind}?startDate=${startISO}&endDate=${endISO}&api_key=${encodeURIComponent(apiKey)}`,
    `https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/${kind}?startDate=${startISO}&endDate=${endISO}`,
  ]
}

export interface Flare { id: string; peak: number; cls: string; letter: 'A' | 'B' | 'C' | 'M' | 'X'; mag: number }
export interface Sep { id: string; t: number }
export interface Storm { id: string; t: number; kp: number }

export interface Donki { flares: Flare[]; sep: Sep[]; storms: Storm[]; fetchedAt: number }

const time = (x: unknown): number => (typeof x === 'string' ? Date.parse(x.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(x) ? x : x + 'Z') : NaN)
const arr = (raw: unknown): Record<string, unknown>[] => (Array.isArray(raw) ? raw.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object') : [])

const FLARE_RANK: Record<Flare['letter'], number> = { A: 0, B: 1, C: 2, M: 3, X: 4 }
export const flareScore = (f: Flare): number => FLARE_RANK[f.letter] * 100 + f.mag

export function parseFlares(raw: unknown): Flare[] {
  const out: Flare[] = []
  for (const r of arr(raw)) {
    const cls = typeof r.classType === 'string' ? r.classType.trim().toUpperCase() : ''
    const m = cls.match(/^([ABCMX])(\d+(?:\.\d+)?)$/)
    const peak = time(r.peakTime ?? r.beginTime)
    if (!m || !Number.isFinite(peak)) continue
    out.push({ id: String(r.flrID ?? `${cls}@${peak}`), peak, cls, letter: m[1] as Flare['letter'], mag: Number(m[2]) })
  }
  return out.sort((a, b) => a.peak - b.peak)
}

export function parseSep(raw: unknown): Sep[] {
  const out: Sep[] = []
  for (const r of arr(raw)) {
    const t = time(r.eventTime)
    if (Number.isFinite(t)) out.push({ id: String(r.sepID ?? t), t })
  }
  return out.sort((a, b) => a.t - b.t)
}

export function parseStorms(raw: unknown): Storm[] {
  const out: Storm[] = []
  for (const r of arr(raw)) {
    const t = time(r.startTime)
    if (!Number.isFinite(t)) continue
    const kp = Math.max(0, ...arr(r.allKpIndex).map((k) => Number(k.kpIndex)).filter(Number.isFinite))
    out.push({ id: String(r.gstID ?? t), t, kp })
  }
  return out.sort((a, b) => a.t - b.t)
}

export const buildDonki = (flr: unknown, sep: unknown, gst: unknown, fetchedAt: number): Donki =>
  ({ flares: parseFlares(flr), sep: parseSep(sep), storms: parseStorms(gst), fetchedAt })

/** A saved reading older than this is shown as "last known". */
export const DONKI_STALE_MS = 24 * H //  DONKI changes slowly, but a day-old list must not look current

export type DonkiLevel = 'quiet' | 'watch' | 'alert'
export interface DonkiAdvice { level: DonkiLevel; title: string; text: string; action: string; facts: string[] }

const dayLabel = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function donkiAdvice(d: Donki, nowMs: number, phase: Phase): DonkiAdvice {
  // Beyond Earth's magnetic field (transit, surface) particle events matter most. On the ground they are only news.
  const deep = phase === 'transit' || phase === 'surface'
  const ground = phase === 'preflight' || phase === 'return'
  const within = (t: number, hours: number) => nowMs - t >= 0 && nowMs - t < hours * H

  const sep = d.sep.filter((s) => within(s.t, 72))
  const xFlares = d.flares.filter((f) => f.letter === 'X' && within(f.peak, 24))
  const storms = d.storms.filter((g) => within(g.t, 48) && g.kp >= 7)
  const week = d.flares.filter((f) => within(f.peak, 7 * 24))
  const strongest = week.reduce<Flare | null>((m, f) => (!m || flareScore(f) > flareScore(m) ? f : m), null)
  const bigOnes = week.filter((f) => f.letter === 'M' || f.letter === 'X').length

  const facts = [
    strongest ? `Strongest flare in 7 days: ${strongest.cls} on ${dayLabel(strongest.peak)} (${bigOnes} M or X class).` : 'No flares reported in the last 7 days.',
    `Particle events in the last 72 h: ${sep.length}.`,
    `Geomagnetic storms in the last 48 h: ${d.storms.filter((g) => within(g.t, 48)).length}${storms.length ? ` (Kp ${Math.max(...storms.map((g) => g.kp))} or more)` : ''}.`,
  ]

  if (sep.length) {
    return {
      level: deep ? 'alert' : 'watch',
      title: 'Solar particle event in the last 72 hours',
      text: deep
        ? 'High-energy protons from the Sun can sharply raise radiation dose outside Earth’s magnetic field.'
        : ground ? 'A solar particle event is under way. The atmosphere and magnetic field shield people on the ground.'
          : 'Particle radiation is raised. Earth’s field still helps a little, but EVA crews are more exposed.',
      action: ground ? 'No action needed on the ground.' : deep
        ? 'Follow your radiation flight rules: be ready to move to the best-shielded area and check the dosimeter.'
        : 'Review EVA plans and check the dosimeter.',
      facts,
    }
  }
  if (xFlares.length) {
    return {
      level: ground ? 'quiet' : 'watch',
      title: `X-class solar flare (${xFlares[xFlares.length - 1].cls}) in the last 24 hours`,
      text: 'Strong flares can be followed by a particle event within minutes to hours.',
      action: ground ? 'No action needed on the ground.' : 'Watch for particle event warnings and keep shelter procedures ready.',
      facts,
    }
  }
  if (storms.length) {
    return {
      level: ground ? 'quiet' : 'watch',
      title: `Severe geomagnetic storm (Kp ${Math.max(...storms.map((g) => g.kp))})`,
      text: 'Strong storms can raise radiation on high-latitude orbit passes and disturb communications.',
      action: ground ? 'No action needed on the ground.' : 'Expect possible radio problems and check the dosimeter.',
      facts,
    }
  }
  return {
    level: 'quiet',
    title: 'No major solar events',
    text: 'No particle events in 72 h, no X-class flares in 24 h and no severe storms in 48 h.',
    action: '',
    facts,
  }
}
