// "How it works": steps scroll on the left, the one in the middle of the screen
// lights up; on desktop a pinned window on the right shows that step.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

export interface Step { kicker: string; title: string; body: string; points: string[]; hsl: string; label: string; win: ReactNode }

export function Story({ steps }: { steps: Step[] }) {
  const [active, setActive] = useState(0)
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const els = list.current?.querySelectorAll<HTMLElement>('[data-step]')
    if (!els?.length) return
    let settle = 0
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) {
        clearTimeout(settle)
        const n = Number((e.target as HTMLElement).dataset.step)
        settle = window.setTimeout(() => setActive(n), 90)
      }
    }, { rootMargin: '-45% 0px -45% 0px' })
    els.forEach((el) => io.observe(el))
    return () => { clearTimeout(settle); io.disconnect() }
  }, [])

  return (
    <div className="wrap story">
      <ol ref={list}>
        {steps.map((s, i) => {
          const on = i === active
          return (
            <li key={s.kicker} data-step={i} style={{ opacity: on ? 1 : 0.38 }}>
              <span className="rail"><b style={{ height: on ? '100%' : '0%', background: `hsl(${s.hsl})` }} /></span>
              <div className="row">
                <span className="num" style={{ borderColor: on ? `hsl(${s.hsl})` : '#334155', background: on ? `hsl(${s.hsl})` : 'transparent', color: on ? '#070b14' : '#64748b', boxShadow: on ? '-4px 4px 0 0 #e2e8f0' : 'none' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="kicker" style={{ margin: 0, color: on ? `hsl(${s.hsl})` : '#64748b' }}>{s.kicker}</span>
              </div>
              <h3 style={{ color: on ? '#fff' : '#64748b' }}>{s.title}</h3>
              <p style={{ maxWidth: 460, color: '#cbd5e1', fontSize: '1.02rem' }}>{s.body}</p>
              <div className="points">
                {s.points.map((pt) => (
                  <span key={pt} style={{ borderColor: on ? `hsl(${s.hsl} / .5)` : '#1e293b', color: on ? '#e2e8f0' : '#64748b' }}>
                    <ArrowRight size={11} style={{ verticalAlign: -1, marginRight: 4, color: on ? `hsl(${s.hsl})` : undefined }} />{pt}
                  </span>
                ))}
              </div>
              <div className="mobile-win"><Win step={s} i={i} n={steps.length} /></div>
            </li>
          )
        })}
      </ol>
      <div className="pinned-col">
        <div className="pinned">
          <div style={{ width: '100%' }}>
            <Win key={active} step={steps[active]} i={active} n={steps.length} animated />
          </div>
        </div>
      </div>
    </div>
  )
}

function Win({ step, i, n, animated }: { step: Step; i: number; n: number; animated?: boolean }) {
  return (
    <div className={`window${animated ? ' win-enter' : ''}`} style={{ boxShadow: `-10px 10px 0 0 hsl(${step.hsl})` }}>
      <div className="wstrip">
        <span><i style={{ background: `hsl(${step.hsl})` }} />{step.label}</span>
        <span style={{ color: '#64748b' }}>{String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>
      </div>
      <div className="wbody">{step.win}</div>
    </div>
  )
}
