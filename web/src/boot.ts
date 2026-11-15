// Opening: keep the logo up briefly, then dissolve into the app (no landing page).
const started = performance.now()
export function bootDone() {
  const boot = document.getElementById('boot')
  if (!boot || boot.classList.contains('gone')) return
  const wait = Math.max(0, 650 - (performance.now() - started))
  setTimeout(() => {
    boot.classList.add('gone')
    document.getElementById('root')?.classList.add('app-in')
    setTimeout(() => boot.remove(), 600)
  }, wait)
}
