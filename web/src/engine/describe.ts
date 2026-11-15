// Plain-language wording for a metric's status. The numbers behind it stay available
// under "How we know" — the statistics are for checking, not for reading first.
import { METRICS, type StatusResult } from './status'

const n = (v?: number) => (v == null ? '—' : String(Number(v.toFixed(Math.abs(v) >= 10 ? 0 : 1))))
/** "3/10", "10%", "4.5 h" — no space before / or %. */
const u = (v: number | undefined, unit: string) => `${n(v)}${unit.startsWith('/') || unit === '%' ? '' : ' '}${unit}`

const PHRASE: Record<string, { up: string; down: string }> = {
  hr_rest: { up: 'Resting heart rate is higher than usual', down: 'Resting heart rate is lower than usual' },
  resp_rate: { up: 'You are breathing faster than usual at rest', down: 'You are breathing slower than usual at rest' },
  blink_rate: { up: 'You are blinking more than usual, which can mean tiredness', down: 'You are blinking less than usual' },
  perclos: { up: 'Your eyes were closed more than usual, which can mean tiredness', down: 'Your eyes were more open than usual' },
  face_width: { up: 'Your face looks fuller than usual, which can mean fluid moving to the head', down: 'Your face looks slimmer than usual' },
  mood: { up: 'Your mood is better than usual', down: 'Your mood is lower than usual' },
  energy: { up: 'More energy than usual', down: 'Less energy than usual' },
  sleep_hours: { up: 'You slept more than usual', down: 'You slept less than usual' },
  sleep_quality: { up: 'Better sleep than usual', down: 'Worse sleep than usual' },
  sway_eo: { up: 'You swayed more than usual standing still', down: 'You swayed less than usual' },
  sway_ec: { up: 'You swayed more than usual with eyes closed', down: 'You swayed less than usual with eyes closed' },
  sway_tandem: { up: 'You swayed more than usual heel-to-toe', down: 'You swayed less than usual heel-to-toe' },
  sts_time: { up: 'Standing up 5 times took longer than usual', down: 'Standing up 5 times was faster than usual' },
  body_mass: { up: 'Your body mass is above your usual', down: 'Your body mass is below your usual' },
}

export function plain(id: string, r: StatusResult): string {
  const m = METRICS[id]
  if (r.level === 'nodata' && r.why === 'skipped') return `${m.label}: not measured today (face scan skipped).`
  if (r.level === 'nodata' && r.why === 'stale') return `${m.label}: no current reading (last measured ${r.ageDays ?? 'several'} days ago).`
  if (r.level === 'nodata') return `${m.label}: couldn’t be measured well this time (light, movement or not enough time).`
  if (r.level === 'baseline') return `${m.label}: still learning your normal (${r.n ?? 0} of 7 days).`
  if (r.level === 'usual') return `${m.label}: in your normal range.`
  const up = (r.value ?? 0) > (r.median ?? 0)
  const p = PHRASE[id]
  const head = p ? (up ? p.up : p.down) : `${m.label} is ${up ? 'higher' : 'lower'} than usual`
  return `${head} (${u(r.value, m.unit)}; usually about ${u(r.median, m.unit)}).`
}

/** The statistics, for anyone who wants to check the rule. */
export function technical(r: StatusResult): string {
  return r.reasons.join(' ')
}
