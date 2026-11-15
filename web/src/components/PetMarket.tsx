// Space Exchange: a made-up stock market that runs on care points. A game, not advice.
// Prices and rules live in engine/market.ts and engine/petgame.ts.
import { useState } from 'react'
import { Lock, Minus, Plus, Star as StarIcon, TrendingUp } from 'lucide-react'
import type { StageId } from '../engine/pet'
import { stageName } from '../engine/petshop'
import { buyCost, change24h, priceAt, priceSeries, sellValue, STOCKS, type Stock } from '../engine/market'
import { buyShares, type Game, MARKET_MIN_STAGE, marketOpen, positions, sellShares } from '../engine/petgame'
import { Spark } from './ui'

const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`

export function PetMarket({ name, stage, balance, game, update, now }: {
  name: string
  stage: StageId
  balance: number
  game: Game
  update: (next: (g: Game) => Game) => void
  now: number
}) {
  const [id, setId] = useState(STOCKS[0].id)
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const open = marketOpen(stage)
  const stock: Stock = STOCKS.find((s) => s.id === id) ?? STOCKS[0]
  const price = priceAt(stock, now)
  const held = game.holdings[stock.id]
  const pos = positions(game, now)
  const worth = pos.reduce((a, p) => a + p.value, 0)
  const cost = pos.reduce((a, p) => a + p.cost, 0)
  const q = Math.max(1, Math.min(99, qty))

  const buy = () => {
    let ok = false
    update((g) => { const r = buyShares(g, stock.id, q, Date.now(), balance, stage); ok = r.ok; return r.ok ? r.game : g })
    setNote(ok ? `Bought ${q} ${stock.id} for ${buyCost(price, q)} points.` : `Not enough points for ${q} ${stock.id}.`)
  }
  const sell = (n: number) => {
    let ok = false
    update((g) => { const r = sellShares(g, stock.id, n, Date.now()); ok = r.ok; return r.ok ? r.game : g })
    if (ok) setNote(`Sold ${n} ${stock.id} for ${sellValue(price, n)} points.`)
  }

  return (
    <div className="card pet-market">
      <div className="card-h">
        <span className="ic"><TrendingUp /></span>
        <h3>Space Exchange</h3>
        <span className="sub shop-balance"><StarIcon size={13} /> {balance} to spend</span>
      </div>
      <p className="muted shop-intro">
        A pretend market with made-up companies, just for fun. No real money, no real prices and no advice: it only moves care points. Prices can go down as well as up. It never touches your results, your accessories or how {name} grows.
      </p>

      {!open ? (
        <div className="mk-locked">
          <Lock size={18} />
          <div>
            <b>Opens when {name} is a {stageName(MARKET_MIN_STAGE)}</b>
            <small className="muted">Seven daily checks gets there. Until then, trips are the way to earn more points.</small>
          </div>
        </div>
      ) : (
        <>
          <div className="mk-folio">
            <span><small className="muted">Invested</small><b className="mono">{worth}</b></span>
            <span><small className="muted">Paid</small><b className="mono">{cost}</b></span>
            <span><small className="muted">Gain</small><b className={`mono ${worth - cost >= 0 ? 'up' : 'down'}`}>{signed(worth - cost)}</b></span>
          </div>

          <div className="mk-list" role="list">
            {STOCKS.map((s) => {
              const p = priceAt(s, now)
              const ch = change24h(s, now)
              const h = game.holdings[s.id]
              return (
                <button key={s.id} role="listitem" className={`mk-row${s.id === id ? ' sel' : ''}`} aria-pressed={s.id === id} onClick={() => { setId(s.id); setNote('') }}
                  aria-label={`${s.name}, ${p} points, ${pct(ch)} in 24 hours${h ? `, you hold ${h.shares}` : ''}`}>
                  <span className="mk-tick mono">{s.id}</span>
                  <span className="mk-name">{s.name}{h && <small className="muted"> · {h.shares} held</small>}</span>
                  <span className="mk-px mono">{p.toFixed(1)}</span>
                  <span className={`mk-ch mono ${ch >= 0 ? 'up' : 'down'}`}>{pct(ch)}</span>
                </button>
              )
            })}
          </div>

          <div className="mk-detail">
            <div className="row between">
              <b>{stock.name}</b>
              <span className="mono">{price.toFixed(1)} <small className="muted">points</small></span>
            </div>
            <small className="muted">{stock.blurb}</small>
            <Spark values={priceSeries(stock, now, 48)} width={300} height={64} />
            <small className="muted">Last 48 hours · {pct(change24h(stock, now))} in 24 h{held ? ` · you hold ${held.shares} (worth ${sellValue(price, held.shares)})` : ''}</small>

            <div className="mk-trade">
              <div className="mk-qty" role="group" aria-label="Shares">
                <button className="btn small icon" aria-label="Fewer shares" onClick={() => setQty(Math.max(1, q - 1))}><Minus /></button>
                <span className="mono" aria-live="polite">{q}</span>
                <button className="btn small icon" aria-label="More shares" onClick={() => setQty(Math.min(99, q + 1))}><Plus /></button>
              </div>
              <button className="btn primary" disabled={buyCost(price, q) > balance} onClick={buy}>Buy · {buyCost(price, q)}</button>
              <button className="btn" disabled={!held || held.shares < q} onClick={() => sell(q)}>Sell · {held ? `+${sellValue(price, Math.min(q, held.shares))}` : '0'}</button>
              {held && held.shares > q && <button className="btn ghost" onClick={() => sell(held.shares)}>Sell all</button>}
            </div>
            <small className="muted shop-hint-line" aria-live="polite">{note || 'Buy and sell at the current price. Whole points only, rounded against you, so you cannot make points from nothing.'}</small>
          </div>
        </>
      )}
    </div>
  )
}
