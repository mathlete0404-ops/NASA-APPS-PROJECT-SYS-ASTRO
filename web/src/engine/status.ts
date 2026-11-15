// Personal-baseline status engine. Port of server/app/engine.py — both are tested
// against shared/status_cases.json. Rules, not AI: every status carries its reasons.
import metricsJson from '../../../shared/metrics.json'

export type Level = 'usual' | 'watch' | 'act' | 'nodata' | 'baseline'
export interface MetricDef { id: string; label: string; unit: string; floor: number; group: string; source: string }
export interface StatusResult {
  level: Level
  reasons: string[]
  z?: number
  median?: number
  scale?: number
  value?: number
  n?: number
  /** Why it is No data: a poor measurement, a face scan skipped in the latest check, or too old. */
  why?: 'quality' | 'skipped' | 'stale'
  /** Days since the last reading (stale only). */
  ageDays?: number
}

export const METRICS: Record<string, MetricDef> = Object.fromEntries(
  (metricsJson.metrics as MetricDef[]).map((m) => [m.id, m]),
)
export const BASELINE_N = 7
export const WATCH_Z = 2
export const ACT_Z = 3
export const WATCH_STREAK = 3
const MAD_TO_SD = 1.4826

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const fmt = (x: number) => String(Number(x.toFixed(Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2)))

/** history: chronological [value, qualityOk]. Status describes the latest entry. */
export function metricStatus(metric: string, history: [number | null, boolean][]): StatusResult {
  const floor = METRICS[metric]?.floor ?? 1e-6
  if (!history.length) return { level: 'nodata', reasons: ['No measurement yet.'] }
  const [value, ok] = history[history.length - 1]
  if (value == null || !ok)
    return { level: 'nodata', reasons: ['Latest measurement failed the quality check, so it is shown as No data, not Fine.'] }

  const good = history.flatMap(([v, q], i) => (q && v != null ? [[i, v] as [number, number]] : []))
  const base = good.slice(0, BASELINE_N).map(([, v]) => v)
  if (base.length < BASELINE_N || good[BASELINE_N - 1][0] >= history.length - 1) {
    const n = Math.min(base.length, BASELINE_N)
    return { level: 'baseline', n, value, reasons: [`Building your personal baseline (${n}/${BASELINE_N} good sessions).`] }
  }
  const med = median(base)
  const mad = median(base.map((v) => Math.abs(v - med)))
  const scale = Math.max(MAD_TO_SD * mad, floor)
  const zOf = (v: number) => (v - med) / scale
  const z = zOf(value)
  const after = good.filter(([i]) => i > good[BASELINE_N - 1][0]).map(([, v]) => v)
  const reasons = [
    `Baseline median ${fmt(med)}, robust spread ${Number(scale.toPrecision(3))} (1.4826 × MAD, floor ${fmt(floor)}); today z = ${z >= 0 ? '+' : ''}${z.toFixed(1)}.`,
  ]
  let level: Level
  if (Math.abs(z) > ACT_Z) {
    level = 'act'
    reasons.push(`|z| > ${ACT_Z}: far from your own usual.`)
  } else if (Math.abs(z) > WATCH_Z) {
    level = 'watch'
    reasons.push(`|z| > ${WATCH_Z}: outside your usual range.`)
    const tail = after.slice(-WATCH_STREAK)
    if (tail.length === WATCH_STREAK && tail.every((v) => Math.abs(zOf(v)) > WATCH_Z)) {
      level = 'act'
      reasons.push(`Watch ${WATCH_STREAK} sessions in a row → Act.`)
    }
  } else level = 'usual'
  return { level, z: Math.round(z * 100) / 100, median: med, scale, value, reasons }
}

export const LEVEL_LABEL: Record<Level, string> = {
  usual: 'Usual',
  watch: 'Watch',
  act: 'Act',
  nodata: 'No data',
  baseline: 'Learning',
}
// Overall = most urgent metric. A baseline still being built never outranks a real result.
export const LEVEL_RANK: Record<Level, number> = { act: 4, watch: 3, nodata: 2, usual: 1, baseline: 0 }
export const worst = (ls: Level[]): Level =>
  ls.length ? ls.reduce((w, l) => (LEVEL_RANK[l] > LEVEL_RANK[w] ? l : w)) : 'nodata'
