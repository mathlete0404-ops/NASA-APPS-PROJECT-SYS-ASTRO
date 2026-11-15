// Crew Mirror service worker: cache-first for the app shell, wasm and models so the
// app keeps working with no network (the spacecraft case). API calls are never cached.
const CACHE = 'crew-mirror-v2'
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html']))) })
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.pathname.includes('/api/')) return
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && (url.origin === location.origin || url.hostname === 'storage.googleapis.com')) {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy))
      }
      return res
    }).catch(() => (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  )
})

// Daily check reminders (web): tapping one opens the daily check.
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const hash = (e.notification.data && e.notification.data.url) || '#/app/check'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) { c.navigate(new URL(hash, c.url).href).catch(() => undefined); return c.focus() }
    return self.clients.openWindow(new URL('./' + hash, self.registration.scope).href)
  }))
})
