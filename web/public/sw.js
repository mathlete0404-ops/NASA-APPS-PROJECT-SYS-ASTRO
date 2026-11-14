// Crew Mirror service worker: cache-first for the app shell, wasm and models so the
// app keeps working with no network (the spacecraft case). API calls are never cached.
const CACHE = 'crew-mirror-v1'
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
    }).catch(() => caches.match('./index.html')))
  )
})
