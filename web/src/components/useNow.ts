import { useEffect, useState } from 'react'

/** The current time in ms, refreshed on an interval (and when the tab comes back into view). */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = window.setInterval(tick, everyMs)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [everyMs])
  return now
}

/** "2 h 10 min", "45 min", "under a minute". */
export function fmtDuration(ms: number): string {
  const min = Math.ceil(ms / 60_000)
  if (min < 1) return 'under a minute'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
