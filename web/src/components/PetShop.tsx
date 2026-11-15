// Pet shop panel: pick an accessory, try it on the big pet for free, buy it with care points.
// Rules and prices live in engine/petshop.ts. Cosmetic only; nothing here touches health results.
import { useState } from 'react'
import { Check, Lock, ShoppingBag, Star as StarIcon } from 'lucide-react'
import type { StageId } from '../engine/pet'
import { availability, balance, buy, ITEMS, SLOTS, stageName, takeOff, wear, type Availability, type ShopItem, type Slot, type Wardrobe } from '../engine/petshop'
import { Pet } from './Pet'

const Points = ({ n }: { n: number }) => <span className="shop-pts mono"><StarIcon size={12} />{n}</span>

const STATE_LABEL: Record<Availability, string> = { worn: 'Wearing', owned: 'Owned', buy: '', poor: '', locked: '' }

export function PetShop({ name, stage, xp, wardrobe, update, selected, onSelect }: {
  name: string
  stage: StageId
  xp: number
  wardrobe: Wardrobe
  update: (next: (w: Wardrobe) => Wardrobe) => void
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const [slot, setSlot] = useState<Slot>('head')
  const [note, setNote] = useState('')
  const points = balance(xp, wardrobe)
  const shown = ITEMS.filter((i) => i.slot === slot)
  const sel = selected ? ITEMS.find((i) => i.id === selected && i.slot === slot) ?? null : null
  const state = sel ? availability(sel, wardrobe, xp, stage) : null
  const wornCount = Object.keys(wardrobe.worn).length
  // Tiles show the pet at a stage that can wear everything, so locked items still preview.
  const thumbStage: StageId = stage === 'egg' ? 'hatchling' : stage

  const pick = (item: ShopItem) => { setNote(''); onSelect(selected === item.id ? null : item.id) }
  const doBuy = (item: ShopItem) => {
    let bought = false
    update((w) => { const r = buy(w, item.id, xp, stage); bought = r.ok; return r.ok ? r.wardrobe : w })
    if (bought) { setNote(`Bought: ${item.name}. ${name} is wearing it.`); onSelect(null) }
  }
  const doWear = (item: ShopItem) => { update((w) => wear(w, item.id)); setNote(`${name} is wearing the ${item.name.toLowerCase()}.`); onSelect(null) }
  const doOff = (item: ShopItem) => { update((w) => takeOff(w, item.slot)); setNote(`${item.name} is back in the wardrobe.`); onSelect(null) }

  return (
    <div className="card pet-shop">
      <div className="card-h">
        <span className="ic"><ShoppingBag /></span>
        <h3>Pet shop</h3>
        <span className="sub shop-balance" aria-label={`${points} care points to spend`}><StarIcon size={13} /> {points} to spend</span>
      </div>
      <p className="muted shop-intro">
        Spend care points on looks for {name}. They are just for fun: accessories never change your results or how {name} grows, and you never lose one.
      </p>

      <div className="seg shop-tabs" role="tablist" aria-label="Shop sections">
        {SLOTS.map((s) => {
          const owned = ITEMS.filter((i) => i.slot === s.id && wardrobe.owned.includes(i.id)).length
          const total = ITEMS.filter((i) => i.slot === s.id).length
          return (
            <button key={s.id} role="tab" aria-selected={slot === s.id} className={slot === s.id ? 'on' : ''}
              onClick={() => { setSlot(s.id); onSelect(null); setNote('') }}>
              {s.label} <small className="mono">{owned}/{total}</small>
            </button>
          )
        })}
      </div>

      <div className="shop-grid" role="tabpanel">
        {shown.map((item) => {
          const a = availability(item, wardrobe, xp, stage)
          const on = selected === item.id
          return (
            <button key={item.id} type="button" className={`shop-item${on ? ' sel' : ''}${a === 'locked' ? ' locked' : ''}${a === 'worn' ? ' worn' : ''}`}
              aria-pressed={on} onClick={() => pick(item)}
              aria-label={`${item.name}. ${a === 'worn' ? 'Wearing' : a === 'owned' ? 'Owned' : a === 'locked' ? `Unlocks at ${stageName(item.minStage!)}` : `${item.price} care points`}`}>
              <span className="shop-thumb"><Pet stage={thumbStage} mood="content" size={84} name={item.name} wear={{ [item.slot]: item.id }} /></span>
              <span className="shop-name">{item.name}</span>
              <span className="shop-state">
                {a === 'worn' || a === 'owned' ? <span className={`shop-own${a === 'worn' ? ' on' : ''}`}>{a === 'worn' && <Check size={12} />}{STATE_LABEL[a]}</span>
                  : a === 'locked' ? <span className="shop-lock"><Lock size={12} />{stageName(item.minStage!)}</span>
                    : <Points n={item.price} />}
              </span>
            </button>
          )
        })}
      </div>

      <div className="shop-detail" aria-live="polite">
        {sel && state ? (
          <>
            <div className="shop-detail-t">
              <b>{sel.name}</b>
              {state === 'buy' || state === 'poor' ? <Points n={sel.price} /> : null}
              <small className="muted">{sel.blurb}</small>
              <small className="shop-try">{state === 'worn' ? `${name} is wearing this.` : `Trying it on ${name} now. Nothing is spent until you buy.`}</small>
            </div>
            <div className="shop-actions">
              {state === 'buy' && <button className="btn primary" onClick={() => doBuy(sel)}>Buy for {sel.price}</button>}
              {state === 'poor' && <button className="btn" disabled>Need {sel.price - points} more</button>}
              {state === 'locked' && <button className="btn" disabled><Lock size={14} /> Unlocks at {stageName(sel.minStage!)}</button>}
              {state === 'owned' && <button className="btn primary" onClick={() => doWear(sel)}>Wear it</button>}
              {state === 'worn' && <button className="btn" onClick={() => doOff(sel)}>Take off</button>}
              <button className="btn ghost" onClick={() => onSelect(null)}>Cancel</button>
            </div>
            {state === 'poor' && <small className="muted shop-earn">Earn points by showing up: daily check +10, exercise +5, food log +3, pain report +5.</small>}
            {state === 'locked' && <small className="muted shop-earn">{name} unlocks this as it grows. Daily checks are what move it forward.</small>}
          </>
        ) : (
          <p className="muted shop-hint">{note || `Tap an item to try it on ${name}. Trying on is free.`}</p>
        )}
      </div>
      {wornCount > 0 && !sel && (
        <button className="btn ghost small shop-clear" onClick={() => { update((w) => ({ ...w, worn: {} })); setNote(`${name} is back to the plain look.`) }}>Take everything off</button>
      )}
    </div>
  )
}
