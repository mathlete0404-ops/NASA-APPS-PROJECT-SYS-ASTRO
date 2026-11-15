import { useEffect, useState } from 'react'
import { Moon, Sun, type LucideIcon } from 'lucide-react'
import { LEVEL_LABEL, type Level } from '../engine/status'
import { EVIDENCE } from '../content/evidence'

/** Human-friendly number: 2 decimals under 10, 1 under 100, else whole. */
export function fmtNum(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  return String(Number(v.toFixed(a >= 100 ? 0 : a >= 10 ? 1 : 2)))
}

export function StatusChip({ level, n }: { level: Level; n?: number }) {
  return <span className={`chip ${level}`}>{LEVEL_LABEL[level]}{level === 'baseline' && n != null ? ` ${n}/7` : ''}</span>
}

export function EvidenceChips({ ids }: { ids: string[] }) {
  return (
    <div className="evidence">
      {ids.map((id) => EVIDENCE[id]).filter(Boolean).map((e) => (
        <a key={e.id} className={e.kind} href={e.url} target="_blank" rel="noreferrer" title={e.kind === 'nasa-data' ? 'NASA data' : 'Source'}>
          {e.kind === 'nasa-data' ? '◆ ' : ''}{e.label}
        </a>
      ))}
    </div>
  )
}

/** Line chart with the personal baseline band (median ± 2 robust SD). Theme-aware via CSS classes. */
export function Spark({
  values, median, scale, width = 220, height = 56, okMask,
}: { values: (number | null)[]; median?: number; scale?: number; width?: number; height?: number; okMask?: boolean[] }) {
  const pts = values.map((v, i) => ({ v, i, ok: okMask ? okMask[i] : v != null })).filter((p) => p.v != null) as { v: number; i: number; ok: boolean }[]
  if (pts.length < 2) return <svg width={width} height={height} />
  const lo0 = Math.min(...pts.map((p) => p.v), median != null && scale ? median - 2.5 * scale : Infinity)
  const hi0 = Math.max(...pts.map((p) => p.v), median != null && scale ? median + 2.5 * scale : -Infinity)
  const pad = (hi0 - lo0) * 0.08 || 1
  const lo = lo0 - pad, hi = hi0 + pad
  const X = (i: number) => 4 + (i / Math.max(1, values.length - 1)) * (width - 8)
  const Y = (v: number) => height - 4 - ((v - lo) / (hi - lo)) * (height - 8)
  const d = pts.filter((p) => p.ok).map((p, k) => `${k ? 'L' : 'M'}${X(p.i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ maxWidth: width, height }} aria-hidden>
      {median != null && scale != null && (
        <>
          <rect className="spark-band" x={0} width={width} y={Y(median + 2 * scale)} height={Math.max(1, Y(median - 2 * scale) - Y(median + 2 * scale))} />
          <line className="spark-mid" x1={0} x2={width} y1={Y(median)} y2={Y(median)} strokeDasharray="3 3" />
        </>
      )}
      <path className="spark-line" d={d} fill="none" strokeWidth={2} />
      {pts.map((p) => (
        <circle key={p.i} className={p.ok ? 'spark-dot' : 'spark-bad'} cx={X(p.i)} cy={Y(p.v)} r={p.i === values.length - 1 ? 3.4 : 1.7} />
      ))}
    </svg>
  )
}

/** What a page will show once there is data, and the one thing to do to get there. */
export function EmptyState({ icon: I, title, children, action, onAction }: {
  icon: LucideIcon; title: string; children: React.ReactNode; action?: string; onAction?: () => void
}) {
  return (
    <div className="card empty-state">
      <span className="ic"><I /></span>
      <div className="empty-body">
        <h3>{title}</h3>
        <p className="muted">{children}</p>
        {action && onAction && <button className="btn primary" onClick={onAction}>{action}</button>}
      </div>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <span><strong>Prototype, not a medical device.</strong> Results are patterns, never diagnoses. Camera video never leaves this device.</span>
      <span className="mono">Crew Mirror · Team SYS-ASTRO · NASA Space Apps Seoul 2026 · MIT</span>
    </footer>
  )
}

/** Crew Mirror mark: a mirror (ring) reflecting a face mesh. Original artwork. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#070b14" stroke="currentColor" strokeWidth="0" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="#5eead4" strokeWidth="2.2" />
      <path d="M16 8c-4.2 0-6 3.3-6 6.6 0 4.1 2.5 7.4 6 9.9 3.5-2.5 6-5.8 6-9.9C22 11.3 20.2 8 16 8z" fill="none" stroke="#c4b5fd" strokeWidth="1.5" />
      <circle cx="13.6" cy="14.4" r="1.2" fill="#5eead4" />
      <circle cx="18.4" cy="14.4" r="1.2" fill="#5eead4" />
    </svg>
  )
}

const THEME_KEY = 'crew-mirror:theme'
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  const toggle = () => {
    const root = document.documentElement
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduce) root.classList.add('theme-fade')
    root.classList.toggle('dark')
    try { localStorage.setItem(THEME_KEY, root.classList.contains('dark') ? 'dark' : 'light') } catch { /* ignore */ }
    if (!reduce) setTimeout(() => root.classList.remove('theme-fade'), 560)
  }
  return { dark, toggle }
}

export function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const { dark, toggle } = useTheme()
  return (
    <button className="btn ghost icon" onClick={toggle} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} style={onDark ? { color: '#cbd5e1' } : undefined}>
      {dark ? <Sun /> : <Moon />}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}

/** Counts up from 0 once, on mount (respects reduced motion). */
export function CountUp({ to, ms = 1500 }: { to: number; ms?: number }) {
  const [v, setV] = useState(() => (matchMedia('(prefers-reduced-motion: reduce)').matches ? to : 0))
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      setV(Math.round(to * (1 - Math.pow(1 - k, 4))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, ms])
  return <>{v.toLocaleString()}</>
}
