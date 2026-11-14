// Hero visual: a daily check "building itself" as the reader scrolls.
//   ∅      — no baseline yet: an empty dark sheet
//   scan   — a (synthetic) face mesh draws in, measurements type out
//   compare— a layer slides out: 7 baseline sessions → robust z-score
//   status — a final layer: the status and the next step
// Purely presentational; `progress` 0 → 1 comes from page scroll.
// The mesh is procedurally generated — not anyone's face.

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const ease = (v: number) => 1 - Math.pow(1 - clamp(v), 3)

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

// Synthetic face mesh: an oval of points + eyes, brows, nose and mouth curves.
const MESH: [number, number][] = (() => {
  const r = rng(7)
  const pts: [number, number][] = []
  for (let k = 0; k < 230; k++) {
    const a = r() * Math.PI * 2
    const rad = Math.sqrt(r())
    pts.push([50 + Math.cos(a) * rad * 30, 52 + Math.sin(a) * rad * 40])
  }
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2
    pts.push([50 + Math.cos(a) * 31, 52 + Math.sin(a) * 41])
  }
  for (const cx of [38, 62]) for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2
    pts.push([cx + Math.cos(a) * 6, 44 + Math.sin(a) * 2.6])
  }
  for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push([40 + t * 20, 74 + Math.sin(t * Math.PI) * 4]) }
  for (let k = 0; k <= 8; k++) pts.push([50, 46 + k * 2.6])
  return pts.sort((a, b) => a[1] - b[1])
})()

const LINES: { t: string; cls?: string }[][] = [
  [{ t: 'face ', cls: 'tk-v' }, { t: '478 pts ', cls: 'tk-p' }, { t: '✓', cls: 'tk-f' }],
  [{ t: 'light', cls: 'tk-v' }, { t: ' ok    ', cls: 'tk-p' }, { t: '✓', cls: 'tk-f' }],
  [{ t: 'hr   ', cls: 'tk-k' }, { t: ' ' }, { t: '63 bpm', cls: 'tk-s' }],
  [{ t: 'blink', cls: 'tk-k' }, { t: ' ' }, { t: '21.9/min', cls: 'tk-s' }],
  [{ t: 'sleep', cls: 'tk-k' }, { t: ' ' }, { t: '4.5 h', cls: 'tk-s' }],
]
const TOTAL = LINES.reduce((n, l) => n + l.reduce((m, t) => m + t.t.length, 0) + 1, 0)

export function MirrorBuild({ progress }: { progress: number }) {
  const p = clamp(progress)
  const nullOut = ease((p - 0.04) / 0.1)
  const mesh = ease((p - 0.1) / 0.3)
  const typed = Math.round(TOTAL * clamp((p - 0.18) / 0.32))
  const cmp = ease((p - 0.5) / 0.18)
  const status = ease((p - 0.72) / 0.18)
  const sessions = Math.round(7 * clamp((p - 0.52) / 0.14))

  let budget = typed
  const lines = LINES.map((line) => {
    const parts: { t: string; cls?: string }[] = []
    for (const tok of line) {
      if (budget <= 0) break
      const s = tok.t.slice(0, budget)
      budget -= s.length
      parts.push({ t: s, cls: tok.cls })
    }
    if (budget > 0) budget -= 1
    return parts
  })

  return (
    <div className="mbuild" aria-hidden>
      {/* Layer 3: status (deepest) */}
      <div className="window" style={{
        position: 'absolute', left: '14%', right: 0, bottom: 0, height: '34%',
        transform: `translate(${(1 - status) * -14}%, ${(1 - status) * -40}%)`, opacity: status,
        boxShadow: '-8px 8px 0 0 hsl(43 96% 56%)',
      }}>
        <div className="wstrip"><span><i style={{ background: 'hsl(43 96% 56%)' }} />status.today</span><span>PLT</span></div>
        <div className="wbody" style={{ fontFamily: 'var(--font-body)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="chip act" style={{ color: '#fca5a5', background: '#7f1d1d55' }}>Act</span>
            <b style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: '#fff' }}>Sleep far below your usual</b>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '.85rem', margin: '8px 0 0' }}>Next step: tell the crew medical officer today. Re-check tomorrow.</p>
        </div>
      </div>

      {/* Layer 2: compare to baseline */}
      <div className="window" style={{
        position: 'absolute', left: '8%', right: '6%', top: '40%', height: '30%',
        transform: `translate(${(1 - cmp) * -10}%, ${(1 - cmp) * -50}%)`, opacity: cmp,
        boxShadow: '-8px 8px 0 0 hsl(262 83% 70%)',
      }}>
        <div className="wstrip"><span><i style={{ background: 'hsl(262 83% 70%)' }} />baseline.ts</span><span>{sessions}/7</span></div>
        <div className="wbody">
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} style={{ flex: 1, height: 8, borderRadius: 3, background: i < sessions ? 'hsl(262 83% 70%)' : '#1e293b', transition: 'background .2s' }} />
            ))}
          </div>
          <div><span className="tk-k">z</span> = (4.5 − <span className="tk-s">7.0</span>) / (1.4826 × MAD)</div>
          <div><span className="tk-k">z</span> = <span style={{ color: '#fca5a5', fontWeight: 700 }}>−5.0</span>  <span className="tk-p">|z| &gt; 3 → Act</span></div>
        </div>
      </div>

      {/* Layer 1: the scan */}
      <div className="window" style={{ position: 'absolute', left: 0, right: '12%', top: 0, height: '62%', boxShadow: '-8px 8px 0 0 hsl(168 76% 55%)' }}>
        <div className="wstrip"><span><i style={{ background: 'hsl(168 76% 55%)' }} />daily_check · 60 s</span><span>on-device</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '42% 1fr', height: 'calc(100% - 34px)' }}>
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', background: '#050816' }}>
            {MESH.slice(0, Math.round(MESH.length * mesh)).map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={0.75} fill="#5eead4" opacity={0.85} />
            ))}
            <text x="50" y="56" textAnchor="middle" fontSize="22" fill="#5eead4" opacity={1 - nullOut} fontFamily="Space Grotesk, sans-serif">∅</text>
          </svg>
          <div className="wbody" style={{ padding: '14px 14px', fontSize: '.78rem' }}>
            {p < 0.18 ? (
              <span className="tk-p">no baseline yet<span style={{ opacity: Math.round(p * 40) % 2 ? 1 : 0 }}>▍</span></span>
            ) : lines.map((parts, i) => (
              <div key={i} className="term-line" style={{ minHeight: '1.65em' }}>
                {parts.map((t, k) => <span key={k} className={t.cls}>{t.t}</span>)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
