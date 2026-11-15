import { useEffect, useState } from 'react'
import { Sun } from 'lucide-react'
import type { Phase } from '../content/mission'
import { isStale, stormAdvice, type SpaceWeather } from '../engine/spaceweather'
import { CACHE_EVENT, loadCache } from './SpaceWeatherCard'

/** One-line radiation status for the top of Today. It reads the reading SpaceWeatherCard
 *  saves (no second fetch) and scrolls to that card when clicked. */
export function SpaceWeatherPill({ phase, target }: { phase: Phase; target: string }) {
  const [w, setW] = useState<SpaceWeather | null>(loadCache)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const refresh = () => { setW(loadCache()); setNow(Date.now()) }
    addEventListener(CACHE_EVENT, refresh)
    addEventListener('online', refresh)
    addEventListener('offline', refresh)
    const id = window.setInterval(refresh, 60_000)
    return () => { removeEventListener(CACHE_EVENT, refresh); removeEventListener('online', refresh); removeEventListener('offline', refresh); window.clearInterval(id) }
  }, [])

  let text: string, tone: string
  if (!w) {
    text = 'Space weather: no reading yet'; tone = 'nodata'
  } else {
    const lvl = w.now
    const advice = stormAdvice(lvl, phase)
    const name = lvl.scale === 0 ? 'Quiet' : `radiation storm S${lvl.scale}`
    if (isStale(w, now) || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      text = `Last known: ${name}`; tone = 'nodata'
    } else if (lvl.scale === 0) {
      text = 'Space weather: Quiet'; tone = 'usual'
    } else {
      const ground = phase === 'preflight' || phase === 'return'
      const what = ground ? 'no action on the ground' : advice.urgent ? 'shelter rules apply' : lvl.scale === 2 ? 'check the dosimeter' : 'normal work continues'
      text = `Radiation storm S${lvl.scale}: ${what}`
      tone = advice.urgent ? 'act' : lvl.scale >= 2 ? 'watch' : 'usual'
    }
  }

  return (
    <button type="button" className={`sw-pill ${tone}`} title="Show the solar radiation storm card" onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
      <Sun /><span>{text}</span>
    </button>
  )
}
