import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'
import { initI18n } from './i18n'

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline (PWA): cache the app shell and on-device models after the first visit.
// Skipped in the iOS app (capacitor://): service workers don't run there, and the app
// bundle already holds every file offline.
if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol !== 'capacitor:') {
  // A page that was running under an older worker reloads once when the new one takes over,
  // so nobody stays on an old build after a deploy.
  const hadWorker = Boolean(navigator.serviceWorker.controller)
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadWorker && !reloading) { reloading = true; location.reload() } })
  addEventListener('load', () => void navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').then((r) => r.update()).catch(() => undefined))
}

// A screen's code file from an older deploy is gone (e.g. the 3D body): reload once to get the new build.
addEventListener('vite:preloadError', (e) => {
  try {
    if (sessionStorage.getItem('crew-mirror:reloaded') === location.href) return
    sessionStorage.setItem('crew-mirror:reloaded', location.href)
  } catch { /* storage blocked: still reload */ }
  e.preventDefault()
  location.reload()
})

// Optional Korean: translate visible text when 한국어 is on (English stays the default).
requestAnimationFrame(() => initI18n())
