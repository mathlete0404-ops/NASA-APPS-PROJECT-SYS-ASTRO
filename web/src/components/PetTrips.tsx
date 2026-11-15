// Trips: send the pet out on a trip, and it comes home with care points. The longer the trip and the
// higher the pet's level, the more it brings. Rules and numbers live in engine/petgame.ts.
import { useState } from 'react'
import { Lock, Rocket, Star as StarIcon } from 'lucide-react'
import type { StageId } from '../engine/pet'
import { stageName } from '../engine/petshop'
import { collectTrip, fmtMult, type Game, LEVEL_MULT, MULT_LEVELS, nextLandmark, payout, ROUTES, routeOpen, startTrip, toMiles, tripState } from '../engine/petgame'
import { fmtDuration } from './useNow'

const int = (n: number) => Math.round(n).toLocaleString('en-US')
const Pts = ({ n }: { n: number }) => <span className="shop-pts mono"><StarIcon size={12} />{n}</span>
const fmtKm = (km: number) => (km >= 1e9 ? `${(km / 1e9).toFixed(2)} billion km` : km >= 1e6 ? `${(km / 1e6).toFixed(1)} million km` : `${int(km)} km`)

export function PetTrips({ name, stage, game, update, now }: {
  name: string
  stage: StageId
  game: Game
  update: (next: (g: Game) => Game) => void
  now: number
}) {
  const [note, setNote] = useState('')
  const st = tripState(game, now, stage)
  const next = nextLandmark(game.km)
  const mult = LEVEL_MULT[stage]

  const send = (id: string) => {
    update((g) => { const r = startTrip(g, id, Date.now(), stage); return r.ok ? r.game : g })
    setNote('')
  }
  const collect = () => {
    let msg = ''
    update((g) => { const c = collectTrip(g, Date.now(), stage); if (c) msg = `${name} brought back ${c.reward} care points from the ${c.route.name.toLowerCase()}.`; return c ? c.game : g })
    if (msg) setNote(msg)
  }

  return (
    <div className="card pet-trips">
      <div className="card-h">
        <span className="ic"><Rocket /></span>
        <h3>Trips</h3>
        <span className="sub shop-balance"><StarIcon size={13} /> {fmtMult(mult)} level bonus</span>
      </div>
      <p className="muted shop-intro">
        Send {name} out on a trip and it brings home care points, plus the miles it flew. A trip never runs out and never fails, so come back whenever you like. Only one trip runs at a time.
      </p>

      <div className="trip-status" aria-live="polite">
        {st.kind === 'away' && (
          <>
            <b>{name} is out on the {st.route.name.toLowerCase()}</b>
            <div className="progress" role="progressbar" aria-label="Trip progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(st.progress * 100)}>
              <span style={{ width: `${Math.round(st.progress * 100)}%` }} />
            </div>
            <small className="muted">Back in {fmtDuration(st.remainingMs)} · brings home {payout(st.route, stage)} points</small>
          </>
        )}
        {st.kind === 'back' && (
          <>
            <b>{name} is back from the {st.route.name.toLowerCase()}!</b>
            <small className="muted">{fmtKm(st.route.km)} flown. {st.reward} care points are waiting.</small>
            <div><button className="btn primary" onClick={collect}>Collect {st.reward} points</button></div>
          </>
        )}
        {st.kind === 'idle' && <>
          <b>{name} is home</b>
          <small className="muted">{note || 'Pick a trip below.'}</small>
        </>}
      </div>

      <div className="trip-list">
        {ROUTES.map((r) => {
          const open = routeOpen(r, stage)
          const busy = st.kind !== 'idle'
          return (
            <div key={r.id} className={`trip-row${open ? '' : ' locked'}`}>
              <div className="trip-row-t">
                <b>{r.name}</b>
                <small className="muted">{r.blurb}</small>
                <small className="mono">{r.hours} h · {fmtKm(r.km)}</small>
              </div>
              <div className="trip-row-a">
                <Pts n={payout(r, stage)} />
                {open
                  ? <button className="btn small" disabled={busy} onClick={() => send(r.id)}>Send</button>
                  : <span className="shop-lock"><Lock size={12} />{stageName(r.minStage!)}</span>}
              </div>
            </div>
          )
        })}
      </div>

      <div className="trip-odo">
        <div className="row between">
          <b>Mileage</b>
          <span className="mono">{int(game.km)} km <small className="muted">({int(toMiles(game.km))} mi)</small></span>
        </div>
        <small className="muted">{game.trips} trip{game.trips === 1 ? '' : 's'} so far.</small>
        {next ? (
          <>
            <div className="progress" role="progressbar" aria-label={`Progress to ${next.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(next.progress * 100)}>
              <span style={{ width: `${Math.max(1, Math.round(next.progress * 100))}%` }} />
            </div>
            <small className="muted">{(next.progress * 100).toFixed(next.progress < 0.1 ? 1 : 0)}% of the way to {next.name} ({fmtKm(next.km)})</small>
          </>
        ) : <small className="muted">{name} has flown farther than Neptune.</small>}
      </div>

      <div className="trip-mult">
        <b>Level bonus</b>
        <div className="trip-mult-row">
          {MULT_LEVELS.map((l) => (
            <span key={l} className={`trip-mult-chip${l === stage ? ' on' : ''}`}>{stageName(l)} <b className="mono">{fmtMult(LEVEL_MULT[l])}</b></span>
          ))}
        </div>
        <small className="muted">Every level {name} reaches raises what each trip brings home. The bonus comes from showing up over weeks, never from your results.</small>
      </div>
    </div>
  )
}
