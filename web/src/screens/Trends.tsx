import { activeProfile, crewStatus, history, useStore } from '../data/store'
import { METRICS } from '../engine/status'
import { plain } from '../engine/describe'
import { Spark, StatusChip } from '../components/ui'

export function Trends() {
  const s = useStore()
  const p = activeProfile(s)
  if (!p) return null
  const st = crewStatus(s, p.id)
  const ids = Object.keys(METRICS).filter((id) => history(s.sessions, p.id, id).length)
  return (
    <div className="stack">
      <div className="card">
        <h2>Trends · {p.id}</h2>
        <p className="muted">Each line is you compared with yourself. The shaded band is your normal range, learned from your first 7 days. Grey dots were measurements that weren’t good enough to use.</p>
        <div className="legend"><span><i style={{ background: '#34d39933' }} />usual range</span><span><i style={{ background: '#93c5fd' }} />your values</span><span><i style={{ background: '#94a3b8' }} />No data</span></div>
      </div>
      {ids.length === 0 && <div className="card">No measurements yet.</div>}
      <div className="grid g2">
        {ids.map((id) => {
          const h = history(s.sessions, p.id, id)
          const r = st[id]
          return (
            <div className="card" key={id}>
              <div className="row between">
                <h3>{METRICS[id].label} <small>({METRICS[id].unit})</small></h3>
                <StatusChip level={r.level} n={r.n} />
              </div>
              <Spark width={520} height={120} values={h.map((x) => x.value)} okMask={h.map((x) => x.ok)} median={r.median} scale={r.scale} />
              <div className="row between">
                <small>{new Date(h[0].ts).toLocaleDateString()}</small>
                <small>{h.length} sessions · {METRICS[id].source}</small>
                <small>{new Date(h[h.length - 1].ts).toLocaleDateString()}</small>
              </div>
              <small className="muted">{plain(id, r)}</small>
              <details className="why-details"><summary>How we know</summary><p>{r.reasons.join(' ')}</p></details>
            </div>
          )
        })}
      </div>
    </div>
  )
}
