// Solar events from NASA DONKI, shown inside the solar radiation storm card.
// Fetches flares, particle events and storms for the last 7 days, keeps the last good copy for offline use,
// and never shows an old list as current. Rules and wording live in engine/donki.ts.
//
// NASA's public DEMO_KEY is shared and rate limited (HTTP 429), so: a fresh saved copy is reused instead of
// asking again, every attempt has a timeout, and a crew member can enter their own free key.
import { useEffect, useState } from 'react'
import type { Phase } from '../content/mission'
import { buildDonki, DONKI_KINDS, DONKI_STALE_MS, donkiAdvice, donkiUrls, type Donki, type DonkiKind } from '../engine/donki'
import { EvidenceChips } from './ui'

const KEY = 'crew-mirror:donki:v1'
const API_KEY = 'crew-mirror:nasa-key'
/** Ask NASA again only when the saved copy is older than this. */
const REFRESH_MS = 30 * 60 * 1000
const TIMEOUT_MS = 8000

interface Saved { flr: unknown; sep: unknown; gst: unknown; fetchedAt: number }

const readKey = (): string => { try { return localStorage.getItem(API_KEY) ?? '' } catch { return '' } }
function load(): Donki | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as Saved
    return typeof j.fetchedAt === 'number' ? buildDonki(j.flr, j.sep, j.gst, j.fetchedAt) : null
  } catch { return null }
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

class Busy extends Error {}

/** One list from DONKI: the NASA gateway first, then the DONKI service. An empty body is a real "no events". */
async function getList(kind: DonkiKind, apiKey: string, outer: AbortSignal): Promise<unknown> {
  const end = Date.now()
  let last: unknown
  for (const url of donkiUrls(kind, isoDay(end - 7 * 864e5), isoDay(end), apiKey || 'DEMO_KEY')) {
    const ctl = new AbortController()
    const stop = () => ctl.abort()
    outer.addEventListener('abort', stop)
    const timer = window.setTimeout(stop, TIMEOUT_MS)
    try {
      const r = await fetch(url, { signal: ctl.signal })
      if (r.status === 429) throw new Busy('rate limit')
      if (!r.ok) throw new Error(String(r.status))
      const text = await r.text()
      return text.trim() ? JSON.parse(text) : []
    } catch (e) {
      if (outer.aborted) throw e
      if (e instanceof Busy) { last = e; break } // the service is fine, the shared key is used up: do not hammer it
      last = e
    } finally { window.clearTimeout(timer); outer.removeEventListener('abort', stop) }
  }
  throw last
}

type Net = 'loading' | 'live' | 'fresh' | 'offline' | 'busy'

export function DonkiPanel({ phase }: { phase: Phase }) {
  const [d, setD] = useState<Donki | null>(load)
  const [net, setNet] = useState<Net>('loading')
  const [now, setNow] = useState(() => Date.now())
  const [key, setKey] = useState(readKey)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const ctl = new AbortController()
    const run = () => {
      const saved = load()
      if (saved && Date.now() - saved.fetchedAt < REFRESH_MS) { setNet('fresh'); setNow(Date.now()); return } // reuse, do not spend the shared key
      Promise.all(DONKI_KINDS.map((k) => getList(k, key, ctl.signal)))
        .then(([flr, sep, gst]) => {
          const at = Date.now()
          try { localStorage.setItem(KEY, JSON.stringify({ flr, sep, gst, fetchedAt: at } satisfies Saved)) } catch { /* private mode */ }
          setD(buildDonki(flr, sep, gst, at)); setNow(at); setNet('live')
        })
        .catch((e) => { if (!ctl.signal.aborted) { setNet(e instanceof Busy ? 'busy' : 'offline'); setNow(Date.now()) } })
    }
    run()
    const id = window.setInterval(run, REFRESH_MS)
    return () => { ctl.abort(); window.clearInterval(id) }
  }, [key])

  const saveKey = () => {
    const k = draft.trim()
    try { if (k) localStorage.setItem(API_KEY, k); else localStorage.removeItem(API_KEY) } catch { /* private mode */ }
    try { localStorage.removeItem(KEY) } catch { /* ignore */ } // a new key means ask again now
    setKey(k); setDraft(''); setNet('loading')
  }

  const stale = d ? now - d.fetchedAt > DONKI_STALE_MS : false
  const a = d ? donkiAdvice(d, now, phase) : null
  const tone = !d || stale ? 'nodata' : a?.level === 'alert' ? 'act' : a?.level === 'watch' ? 'watch' : 'usual'
  const problem = net === 'busy'
    ? 'NASA’s shared public key is busy right now (it is rate limited). Try again later, or use your own free key below.'
    : net === 'offline' ? 'No link to NASA DONKI right now.' : ''

  return (
    <div className="donki">
      <div className="row between">
        <h4>Recent solar events · NASA DONKI</h4>
        <span className={`chip ${tone}`}>{!d ? 'No data' : stale ? 'Last known' : a!.level === 'alert' ? 'Alert' : a!.level === 'watch' ? 'Watch' : 'Quiet'}</span>
      </div>
      {!d && <p className="muted"><small>{net === 'loading' ? 'Checking NASA DONKI…' : `${problem} Nothing saved yet, so use the vehicle dosimeter and mission rules.`}</small></p>}
      {d && a && (
        <>
          <p><b>{stale ? 'Last known: ' : ''}{a.title}</b></p>
          <p className="muted" style={{ margin: '0 0 6px' }}>{a.text}</p>
          {a.action && <p style={{ margin: '0 0 6px' }}><b>{a.action}</b></p>}
          <ul className="reasons">{a.facts.map((f) => <li key={f}><small>{f}</small></li>)}</ul>
          <p><small className="muted">{net === 'live' || net === 'fresh' ? 'List' : 'Saved list'} from {new Date(d.fetchedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.{problem && ` ${problem}`}</small></p>
        </>
      )}
      <details className="donki-key">
        <summary>Use your own NASA API key</summary>
        <p><small className="muted">The shared public key is rate limited. A free key from api.nasa.gov has a much higher limit. It is saved only on this device{key ? ' (a key is set)' : ''}.</small></p>
        <form className="row" onSubmit={(e) => { e.preventDefault(); saveKey() }}>
          <input aria-label="NASA API key" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={key ? 'Replace the saved key' : 'Paste your key'} autoComplete="off" spellCheck={false} style={{ flex: 1, minWidth: 160 }} />
          <button className="btn small" type="submit">{draft.trim() ? 'Save key' : key ? 'Remove key' : 'Save key'}</button>
        </form>
      </details>
      <p><small className="muted">Dataset: NASA Space Weather Database Of Notifications, Knowledge, Information (DONKI), NASA CCMC.</small></p>
      <EvidenceChips ids={['donki']} />
    </div>
  )
}
