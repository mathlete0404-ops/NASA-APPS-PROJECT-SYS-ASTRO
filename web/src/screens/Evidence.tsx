import { useMemo, useState } from 'react'
import { OSDR_EVIDENCE, type OsdrAnalyte } from '../content/evidence'
import catalog from '../generated/nasa_catalog.json'
import { api } from '../data/api'
import { useStore } from '../data/store'

const SHOW = ['HEMOGLOBIN', 'RED BLOOD CELL COUNT', 'WHITE BLOOD CELL COUNT', 'PLATELET COUNT', 'GLUCOSE', 'CALCIUM', 'ALBUMIN', 'CREATININE']
const TPS = ['L-92', 'L-44', 'L-3', 'R+1', 'R+45', 'R+82', 'R+194']

export function AnalyteChart({ a }: { a: OsdrAnalyte }) {
  const W = 300, H = 150, padL = 34, padB = 22
  const all = a.subjects.flatMap((s) => [...Object.values(s.series), ...s.pop_range])
  const lo = Math.min(...all), hi = Math.max(...all)
  const pad = (hi - lo) * 0.08 || 1
  const Y = (v: number) => (H - padB) - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - padB - 8)
  const X = (i: number) => padL + (i / (TPS.length - 1)) * (W - padL - 10)
  const colors = ['#14b8a6', '#3b82f6', '#f59e0b', '#d946ef']
  const pr = a.subjects[0].pop_range
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${a.analyte} for 4 Inspiration4 crew`}>
      <rect x={padL} width={W - padL - 10} y={Y(pr[1])} height={Y(pr[0]) - Y(pr[1])} fill="#94a3b833" />
      <text x={padL + 4} y={Y(pr[1]) + 11} fontSize="9" fill="#8f9bc2">population reference range</text>
      <line x1={X(2.5)} x2={X(2.5)} y1={4} y2={H - padB} stroke="#f87171" strokeDasharray="2 3" />
      <text x={X(2.5) + 3} y={12} fontSize="9" fill="#f87171">flight</text>
      {a.subjects.map((s, k) => {
        const pts = TPS.map((t, i) => (s.series as Record<string, number>)[t] != null ? [X(i), Y((s.series as Record<string, number>)[t])] : null).filter(Boolean) as number[][]
        return (
          <g key={s.subject}>
            <rect x={X(0) - 3} width={X(2) - X(0) + 6} y={Y(Math.max(...s.pre))} height={Math.max(1.5, Y(Math.min(...s.pre)) - Y(Math.max(...s.pre)))} fill={colors[k]} opacity={0.18} />
            <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')} fill="none" stroke={colors[k]} strokeWidth={1.6} />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={TPS[i] === 'R+1' && s.outside_personal_range ? 3.5 : 2} fill={colors[k]} />)}
          </g>
        )
      })}
      {TPS.map((t, i) => <text key={t} x={X(i)} y={H - 6} fontSize="9" fill="#8f9bc2" textAnchor="middle">{t}</text>)}
      <text x={4} y={Y(hi)} fontSize="9" fill="#8f9bc2">{+hi.toPrecision(3)}</text>
      <text x={4} y={Y(lo)} fontSize="9" fill="#8f9bc2">{+lo.toPrecision(3)}</text>
    </svg>
  )
}

type Ds = { id: string; title: string; description: string; landing: string; modified?: string; keywords?: string[] }

export function Evidence() {
  const s = useStore()
  const h = OSDR_EVIDENCE.headline
  const analytes = SHOW.map((n) => OSDR_EVIDENCE.analytes.find((a) => a.analyte === n)).filter(Boolean) as OsdrAnalyte[]
  const [q, setQ] = useState('bone')
  const [live, setLive] = useState<{ source: string; datasets: Ds[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const offline = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return (catalog.datasets as Ds[]).filter((d) => terms.every((t) => `${d.title} ${d.description} ${(d.keywords ?? []).join(' ')}`.toLowerCase().includes(t)))
  }, [q])
  const shown = live?.datasets ?? offline

  const searchLive = async () => {
    setBusy(true)
    try { setLive(await api.search(q)) } catch { setLive(null) } finally { setBusy(false) }
  }

  return (
    <div className="stack">
      <div className="card">
        <h2>Why a personal baseline? Evidence from Inspiration4</h2>
        <div className="grid g4" style={{ margin: '10px 0' }}>
          <div><div className="kpi">{h.pairs}</div><small>crew × lab-value pairs ({h.crew} crew, OSD-569 + OSD-575)</small></div>
          <div><div className="kpi">{h.outside_personal_range}</div><small>left the person’s own pre-flight range the day after landing (R+1)</small></div>
          <div><div className="kpi" style={{ color: 'var(--watch)' }}>{h.outside_personal_inside_population}</div><small>of those were still inside the population “normal” range</small></div>
          <div><div className="kpi" style={{ color: 'var(--nodata)' }}>{h.outside_population_range}</div><small>R+1 values outside the population range (all pairs)</small></div>
        </div>
        <p>The day after landing, a population “normal” range flags only <b>{h.outside_population_range}</b> of {h.pairs} values — yet <b>{h.outside_personal_inside_population}</b> changes that left the astronaut’s own pre-flight range stayed “normal”. Comparing each astronaut with <b>their own</b> values sees them: that is the core design choice of Crew Mirror.</p>
        <p className="muted"><small>{OSDR_EVIDENCE.method} Only 3 pre-flight draws per person, so the personal range is narrow and some exits are normal day-to-day variation — Crew Mirror therefore uses 7 baseline sessions and robust z-scores (median / MAD) with a minimum-change floor. Values are shown as published; this is a design argument, not a clinical finding.</small></p>
        <div className="grid g4">
          {analytes.map((a) => (
            <div className="card tight" key={a.analyte}>
              <div className="row between"><b style={{ fontSize: '.85rem' }}>{a.analyte.toLowerCase()}</b><small>{a.unit}</small></div>
              <AnalyteChart a={a} />
              <small className="muted">R+1 mean change {a.mean_r1_change_pct}% · {a.n_outside_personal_inside_pop}/4 personal-only changes</small>
            </div>
          ))}
        </div>
        <p><small>{OSDR_EVIDENCE.credit}. Shaded bars = each crew member’s pre-flight range; big dot = R+1 outside it. Studies: {OSDR_EVIDENCE.studies.map((x) => <a key={x.id} href={x.url} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>{x.id}</a>)}</small></p>
      </div>

      <div className="card">
        <div className="row between">
          <h2>NASA Evidence Library</h2>
          <span className="pill">{live ? `live · ${live.source}` : `offline copy · ${catalog.datasets.length} datasets`}</span>
        </div>
        <p className="muted">Works with no Earth link: an offline copy of data.nasa.gov catalog entries. With the habitat server online it searches the live catalog.</p>
        <div className="row">
          <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setLive(null) }} placeholder="Search e.g. bone, muscle, sleep" style={{ flex: 1, minWidth: 200 }} />
          <button className="btn" onClick={searchLive} disabled={!s.online || busy} title={s.online ? '' : 'Habitat server offline'}>{busy ? 'Searching…' : 'Search live'}</button>
        </div>
        <div className="stack" style={{ marginTop: 10 }}>
          {shown.slice(0, 12).map((d) => (
            <div key={d.id} className="ex">
              <a href={d.landing} target="_blank" rel="noreferrer"><b>{d.title}</b></a>
              <p><small className="muted">{d.description}</small></p>
            </div>
          ))}
          {!shown.length && <p className="muted">No matching datasets in the offline copy.</p>}
        </div>
        <p><small>Dataset metadata from data.nasa.gov</small></p>
      </div>
    </div>
  )
}
