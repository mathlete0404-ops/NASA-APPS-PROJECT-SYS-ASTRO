import { useEffect, useState } from 'react'
import type { Phase } from '../content/mission'
import { isStale, parseProtons, stormAdvice, summarize, SWPC_PROTONS_URL, type SpaceWeather } from '../engine/spaceweather'
import { EvidenceChips, Spark } from './ui'
import { DonkiPanel } from './DonkiPanel'

const CACHE_KEY = 'crew-mirror:spaceweather:v1'

/** Also read by the Today status pill, so both show the same saved reading. */
export function loadCache(): SpaceWeather | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const j = JSON.parse(raw)
    const w = summarize(Array.isArray(j.series) ? j.series : [], Number(j.fetchedAt) || 0)
    return w
  } catch { return null }
}

export const CACHE_EVENT = 'crew-mirror:spaceweather'

function saveCache(w: SpaceWeather) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ series: w.series, fetchedAt: w.fetchedAt })) } catch { /* private mode */ }
  window.dispatchEvent(new Event(CACHE_EVENT))
}

const fmtFlux = (f: number) => (f < 10 ? f.toFixed(2) : String(Math.round(f)))

type Net ='loading' | 'live' | 'offline'

/** Live solar-storm level from NOAA SWPC, with the last reading kept for offline use. */
export function SpaceWeatherCard({ phase }: { phase: Phase }) {
  const [w, setW] = useState<SpaceWeather | null>(loadCache)
  const [net, setNet] = useState<Net>('loading')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const ctl = new AbortController()
    const load = () => {
      fetch(SWPC_PROTONS_URL, { signal: ctl.signal, cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j) => {
          const next = summarize(parseProtons(j), Date.now())
          if (!next) throw new Error('empty')
          saveCache(next)
          setW(next); setNow(Date.now()); setNet('live')
        })
        .catch((e) => { if (e?.name !== 'AbortError') { setNet('offline'); setNow(Date.now()) } })
    }
    load()
    const id = window.setInterval(load, 5 * 60 * 1000)
    return () => { ctl.abort(); window.clearInterval(id) }
  }, [])

  const stale = w ? isStale(w, now) : false
  const advice = w ? stormAdvice(w.now, phase) : null
  const series = w ? w.series.filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 48)) === 0) : []
  const tone = !w || stale ? 'nodata' : advice?.urgent ? 'act' : w.now.scale >= 2 ? 'watch' : 'usual'

  return (
    <div className="card">
      <div className="row between">
        <h3>Solar radiation storm</h3>
        <span className={`chip ${tone}`}>{!w ? 'No data' : stale ? 'Last known' : w.now.label}</span>
      </div>
      {!w && (
        <p className="muted">
          {net === 'loading' ? 'Checking NOAA space weather…' : 'No space-weather link and nothing saved yet. Use the vehicle dosimeter and mission rules.'}
        </p>
      )}
      {w && advice && (
        <>
          <p><b>{stale ? 'Last known: ' : ''}{advice.headline}</b></p>
          <ul className="reasons">{advice.actions.map((a) => <li key={a}>{a}</li>)}</ul>
          <Spark values={series.map((s) => Math.log10(Math.max(s.flux, 0.01)))} height={48} />
          <p>
            <small>
              ≥10 MeV protons: <b>{fmtFlux(w.latest.flux)}</b> pfu now · 24 h peak {w.peakLevel.label} ({fmtFlux(w.peak.flux)} pfu) ·
              {' '}{net === 'live' ? 'live' : 'saved'} reading from {new Date(w.latest.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Chart is log scale.
            </small>
          </p>
        </>
      )}
      <p><small className="muted">Context only: NOAA GOES proton flux, scaled with the NOAA S-scale. Vehicle dosimetry and mission storm rules come first.</small></p>
      <EvidenceChips ids={['swpc', 'radlab']} />
      <DonkiPanel phase={phase} />
    </div>
  )
}
