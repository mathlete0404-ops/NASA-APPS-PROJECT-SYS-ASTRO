import { useEffect, useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { addDownlink, crewStatus, setActiveCrew, uid, useStore } from '../data/store'
import { LEVEL_RANK, METRICS, worst } from '../engine/status'
import { PATTERN_LABEL } from '../engine/triage'
import { REGION_LABEL } from '../content/cards'
import { LIGHT_DELAY } from '../content/mission'
import { EmptyState, fmtNum, StatusChip } from '../components/ui'

function fmtS(s: number) {
  if (s < 60) return `${Math.ceil(s)} s`
  return `${Math.floor(s / 60)} min ${Math.ceil(s % 60)} s`
}

export function Medical({ go }: { go: (t: string) => void }) {
  const s = useStore()
  const [now, setNow] = useState(Date.now())
  const [route, setRoute] = useState('mars-mid')
  const [body, setBody] = useState('')
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  const rows = s.crew.map((c) => {
    const st = crewStatus(s, c.id)
    const alerts = Object.entries(st).filter(([, r]) => r.level === 'act' || r.level === 'watch' || r.level === 'nodata').sort((a, b) => LEVEL_RANK[b[1].level] - LEVEL_RANK[a[1].level])
    const sym = s.symptoms.filter((x) => x.crewId === c.id).sort((a, b) => b.ts.localeCompare(a.ts))
    const symLevel = sym[0]?.result.level
    const lvl = worst([...Object.values(st).map((r) => r.level), ...(symLevel === 'act_now' ? ['act' as const] : symLevel === 'cmo' ? ['watch' as const] : [])])
    const started = Object.keys(st).length > 0 || sym.length > 0
    return { c, st, alerts, sym, lvl, started }
  }).sort((a, b) => LEVEL_RANK[b.lvl] - LEVEL_RANK[a.lvl])

  const delay = LIGHT_DELAY.find((d) => d.id === route)!
  const send = () => {
    const delayS = delay.s
    addDownlink({ id: uid(), crewId: s.activeCrew, body, sentAt: Date.now(), deliverAt: Date.now() + delayS * 1000, delayS, route: delay.label })
    setBody('')
  }
  const summary = () => rows.map(({ c, alerts, sym, lvl, started }) =>
    `${c.id}: ${started ? lvl.toUpperCase() : 'no checks yet'}${alerts.length ? ' — ' + alerts.map(([id, r]) => `${METRICS[id].label} ${fmtNum(r.value)} ${METRICS[id].unit} ${r.level} (z=${r.z})`).join(', ') : ''}${sym[0] ? ` · last symptom: ${REGION_LABEL[sym[0].region]} ${PATTERN_LABEL[sym[0].result.pattern]}` : ''}`).join('\n')

  const noData = !s.sessions.length && !s.symptoms.length

  return (
    <div className="stack">
      {noData && (
        <EmptyState icon={Stethoscope} title="No crew results yet" action="Start today’s check" onAction={() => go('check')}>
          After each crew member’s first daily check, their status appears here, worst first, with the rule behind every alert and their latest pain report. Crew on this device are listed below.
        </EmptyState>
      )}
      <div className="card">
        <div className="row between">
          <h2>Crew medical officer view</h2>
          <span className="pill wrap"><span className={`dot${s.online ? ' on' : ''}`} />{s.online ? 'Habitat server online' : 'Habitat server offline — showing this device'}</span>
        </div>
        <p className="muted">All crew, worst status first. Every alert shows the rule that fired.</p>
        <div className="scroll-x">
          <table className="stack-table">
            <thead><tr><th>Crew</th><th>Status</th><th>Alerts (reason)</th><th>Latest symptom</th><th /></tr></thead>
            <tbody>
              {rows.map(({ c, alerts, sym, lvl, started }) => (
                <tr key={c.id}>
                  <td data-label="Crew"><b>{c.id}</b><br /><small>{c.role}</small></td>
                  <td data-label="Status">{started ? <StatusChip level={lvl} /> : <small className="muted">No checks yet</small>}</td>
                  <td data-label="Alerts">
                    {alerts.length ? alerts.map(([id, r]) => (
                      <div key={id}><StatusChip level={r.level} /> {METRICS[id].label}{r.level === 'nodata' ? <small className="muted"> ({r.why === 'skipped' ? 'face scan skipped' : r.why === 'stale' ? `no check for ${r.ageDays ?? 'several'} days` : 'failed quality check'})</small> : <>: {fmtNum(r.value)} {METRICS[id].unit} <small className="muted">(z {r.z! > 0 ? '+' : ''}{r.z})</small></>}</div>
                    )) : <small className="muted">none</small>}
                  </td>
                  <td data-label="Latest symptom">
                    {sym[0] ? <>
                      <span className={`chip ${sym[0].result.level === 'act_now' ? 'act' : sym[0].result.level === 'cmo' ? 'watch' : 'usual'}`}>{sym[0].result.level === 'act_now' ? 'Act now' : sym[0].result.level === 'cmo' ? 'See CMO' : 'Self-care'}</span>{' '}
                      {REGION_LABEL[sym[0].region]} · {sym[0].intensity}/10<br /><small className="muted">{PATTERN_LABEL[sym[0].result.pattern]} · {new Date(sym[0].ts).toLocaleString()}</small>
                    </> : <small className="muted">none</small>}
                  </td>
                  <td data-label=""><button className="btn small" onClick={() => { setActiveCrew(c.id); go('today') }}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid g2">
        <div className="card stack">
          <h2>Message the Earth flight surgeon</h2>
          <p className="muted">Far from Earth there is no live call: messages travel at light speed. Crew Mirror is built to work without waiting for the answer.</p>
          <div className="row">
            <label>Distance <select value={route} onChange={(e) => setRoute(e.target.value)}>
              {LIGHT_DELAY.map((d) => <option key={d.id} value={d.id}>{d.label} · {d.s < 10 ? `${d.s} s` : fmtS(d.s)} one-way</option>)}
            </select></label>
          </div>
          <textarea aria-label="Message to Earth" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message (derived numbers only — no images or video)" />
          <div className="row">
            <button className="btn" onClick={() => setBody(summary())}>Insert crew status summary</button>
            <button className="btn primary" disabled={!body.trim()} onClick={send}>Queue for downlink</button>
          </div>
        </div>
        <div className="card">
          <h3>Downlink queue</h3>
          {!s.downlink.length && <p className="muted">Nothing sent yet.</p>}
          {s.downlink.map((m) => {
            const left = (m.deliverAt - now) / 1000
            return (
              <div key={m.id} className="ex" style={{ marginBottom: 8 }}>
                <div className="row between">
                  <small>{m.route} · from {m.crewId}</small>
                  <span className={`chip ${left > 0 ? 'watch' : 'usual'}`}>{left > 0 ? `in transit · ${fmtS(left)}` : 'delivered to Earth'}</span>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0', fontSize: '.82rem' }}>{m.body}</pre>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
