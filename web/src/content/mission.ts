export type Phase = 'preflight' | 'transit' | 'landing' | 'surface' | 'return'

export interface PhaseInfo {
  id: Phase
  label: string
  gravity: string
  body: string
  focus: string
  microgravity: boolean
}

export const PHASES: Record<Phase, PhaseInfo> = {
  preflight: {
    id: 'preflight', label: 'Pre-flight', gravity: '1 g', microgravity: false,
    body: 'Normal Earth body.',
    focus: 'Record your baseline: face scan, check-in, balance, body mass.',
  },
  transit: {
    id: 'transit', label: 'Transit (floating)', gravity: '0 g', microgravity: true,
    body: 'Weight-bearing bone loses ~1%/month without countermeasures; the spine lengthens and back muscles shrink; fluid shifts to the head; crews often eat less than they need.',
    focus: 'Daily face scan, pain check, exercise coach, mass trend.',
  },
  landing: {
    id: 'landing', label: 'Landing (G-transition)', gravity: '1 g / 0.38 g / 0.17 g', microgravity: false,
    body: 'The brain must relearn balance; motion sickness and muscle weakness are common for days.',
    focus: 'Balance test before walking or EVA: “safe to walk?” check.',
  },
  surface: {
    id: 'surface', label: 'Moon / Mars surface', gravity: '0.17 g / 0.38 g', microgravity: false,
    body: 'Partial gravity: some loading returns, but much less than on Earth (Mars ≈ 38% of Earth gravity).',
    focus: 'Balance trend, recovery plan, EVA readiness.',
  },
  return: {
    id: 'return', label: 'Return to Earth', gravity: '1 g', microgravity: false,
    body: 'Bone and muscle recovery is slow — months to years for bone.',
    focus: 'Recovery tracking against your pre-flight baseline.',
  },
}

// One-way light time to Earth, used for the delayed downlink (seconds).
export const LIGHT_DELAY: { id: string; label: string; s: number }[] = [
  { id: 'leo', label: 'Low Earth orbit (relay)', s: 1 },
  { id: 'moon', label: 'Moon', s: 1.3 },
  { id: 'mars-near', label: 'Mars, closest', s: 4 * 60 },
  { id: 'mars-mid', label: 'Mars, typical', s: 12 * 60 },
  { id: 'mars-far', label: 'Mars, farthest', s: 24 * 60 },
]

// Typical dose rates (mSv/day) for context only. Mission dosimetry comes from the vehicle.
export const RADIATION_CONTEXT = [
  { place: 'Earth, natural background', mSvDay: 0.0066, source: 'UNSCEAR ≈ 2.4 mSv/year' },
  { place: 'ISS (low Earth orbit)', mSvDay: 0.5, source: 'Typical ~0.3–0.8 mSv/day; varies with solar cycle, orbit and shielding' },
  { place: 'Lunar surface', mSvDay: 1.37, source: 'Zhang et al. 2020, Science Advances (Chang’e-4 LND)' },
  { place: 'Earth→Mars cruise', mSvDay: 1.84, source: 'Zeitlin et al. 2013, Science (MSL RAD)' },
  { place: 'Mars surface', mSvDay: 0.64, source: 'Hassler et al. 2014, Science (MSL RAD)' },
]
