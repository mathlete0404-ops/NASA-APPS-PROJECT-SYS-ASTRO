// "Scan a package": photo → on-device text reading → menu match or nutrition panel →
// the astronaut confirms how much they ate. The photo stays on this device.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Check, Loader2, X } from 'lucide-react'
import { PANTRY, PORTIONS, portionLabel, type Nutrients } from '../content/nutrition'
import { readLabel, type LabelRead } from '../content/label'
import { readPhotoText } from '../vision/ocr'
import { useEscape } from './ui'

export interface ScannedFood { itemId: string; servings: number; custom?: { name: string } & Nutrients }

const FIELDS: [keyof Nutrients, string, string][] = [
  ['kcal', 'Energy', 'kcal'], ['protein', 'Protein', 'g'], ['sodium', 'Sodium', 'mg'], ['calcium', 'Calcium', 'mg'], ['potassium', 'Potassium', 'mg'],
]

export function ScanFood({ file, onAdd, onClose }: { file: File; onAdd: (f: ScannedFood) => void; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [progress, setProgress] = useState(0)
  const [err, setErr] = useState('')
  const [read, setRead] = useState<LabelRead | null>(null)
  const [choice, setChoice] = useState<string>('') // menu id, or 'label' for a custom entry
  const [name, setName] = useState('')
  const [vals, setVals] = useState<Partial<Record<keyof Nutrients, string>>>({})
  const [portion, setPortion] = useState(1)
  const alive = useRef(true)
  useEscape(onClose)

  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  useEffect(() => {
    alive.current = true
    readPhotoText(file, (p) => alive.current && setProgress(p)).then((text) => {
      if (!alive.current) return
      const r = readLabel(text)
      setRead(r)
      const hasFacts = Object.keys(r.facts).length >= 2
      setChoice(r.item && !hasFacts ? r.item.id : hasFacts ? 'label' : r.item?.id ?? 'label')
      setName(r.item?.name ?? r.title)
      setVals(Object.fromEntries(Object.entries(r.facts).map(([k, v]) => [k, String(v)])))
    }).catch((e) => alive.current && setErr(String((e as Error).message ?? e)))
    return () => { alive.current = false }
  }, [file])

  const menuItem = PANTRY.find((x) => x.id === choice)
  const canAdd = choice !== 'label' ? !!menuItem : name.trim().length > 0 && Number(vals.kcal) > 0
  const add = () => {
    if (menuItem) return onAdd({ itemId: menuItem.id, servings: portion })
    const n = (k: keyof Nutrients) => Math.max(0, Number(vals[k]) || 0)
    onAdd({ itemId: 'label', servings: portion, custom: { name: name.trim().slice(0, 40), kcal: n('kcal'), protein: n('protein'), calcium: n('calcium'), sodium: n('sodium'), potassium: n('potassium'), fluid: 0, vitD: n('vitD') } })
  }

  // Portal to <body>: the page's slide-in transform would otherwise move a fixed overlay.
  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-label="Scan a food package" onClick={onClose}>
      <div className="card modal-card scan-card" onClick={(e) => e.stopPropagation()}>
        <div className="row between"><h2 style={{ margin: 0 }}>Scan a food package</h2><button className="btn ghost icon" onClick={onClose} title="Close"><X /></button></div>
        <div className="scan-body">
          {url ? <img className="scan-photo" src={url} alt="Your package photo" /> : <div className="scan-photo" />}
          <div className="stack" style={{ gap: 10, minWidth: 0 }}>
            {!read && !err && (
              <div className="scan-reading"><Loader2 className="spin" /> Reading the label on this device… {Math.round(progress * 100)}%</div>
            )}
            {err && <p className="notice err">Couldn’t read the photo ({err}). Pick the food from the menu instead.</p>}
            {(read || err) && (
              <>
                <p className="muted" style={{ margin: 0, fontSize: '.88rem' }}>
                  {read?.item && choice === read.item.id ? <>Found on the menu: <b>{read.item.name}</b> · {read.item.kind.toLowerCase()}</>
                    : read && Object.keys(read.facts).length >= 2 ? 'Read the nutrition panel. Check the numbers before adding.'
                      : 'Couldn’t match this package. Pick it from the menu, or type the label’s numbers.'}
                </p>
                <label className="stack" style={{ gap: 4 }}><small className="kicker">Food</small>
                  <select value={choice} onChange={(e) => setChoice(e.target.value)}>
                    <option value="label">Not on the menu (use the label’s numbers)</option>
                    {PANTRY.filter((x) => x.id !== 'water' && x.id !== 'vitd').map((x) => <option key={x.id} value={x.id}>{x.name} · {x.kind}</option>)}
                  </select>
                </label>
                {choice === 'label' && (
                  <div className="scan-fields">
                    <label className="span2"><small>Name</small><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Granola bar" /></label>
                    {FIELDS.map(([k, label, unit]) => (
                      <label key={k}><small>{label} ({unit})</small><input type="number" inputMode="decimal" min={0} value={vals[k] ?? ''} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /></label>
                    ))}
                  </div>
                )}
                {menuItem && <p className="mono" style={{ margin: 0, fontSize: '.8rem' }}>{menuItem.serving}: {Math.round(menuItem.n.kcal * portion)} kcal · {Math.round(menuItem.n.protein * portion)} g protein · {Math.round(menuItem.n.sodium * portion)} mg sodium</p>}
                <div>
                  <small className="kicker">How much did you eat?</small>
                  <div className="seg" role="group" aria-label="Portion">
                    {PORTIONS.map((k) => <button key={k} type="button" className={portion === k ? 'on' : ''} onClick={() => setPortion(k)}>{portionLabel(k)}</button>)}
                  </div>
                </div>
                <div className="row"><button className="btn primary" disabled={!canAdd} onClick={add}><Check /> Add to today</button><button className="btn ghost" onClick={onClose}>Cancel</button></div>
              </>
            )}
            <small className="muted"><Camera size={12} style={{ verticalAlign: -2 }} /> The photo is read on this device and never saved or sent.</small>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
