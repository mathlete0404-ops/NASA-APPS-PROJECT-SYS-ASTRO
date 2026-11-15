// Crew Mirror service worker. Works with no network (the spacecraft case) but never gets stuck
// on an old version:
// - the page itself (navigations, index.html) is network-first, cached copy only when offline;
// - hashed build files, wasm and models are cache-first (their names change when they change);
// - old caches are deleted when a new worker takes over. API calls are never cached.
const CACHE = 'crew-mirror-v3'
const SHELL = ['./', './index.html']
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))) })
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
))
const cacheable = (url, res) => res.ok && (url.origin === location.origin || url.hostname === 'storage.googleapis.com')
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.pathname.includes('/api/')) return
  const isPage = e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')
  const isFresh = isPage || url.pathname.endsWith('/sw.js') || url.pathname.endsWith('.webmanifest')
  if (isFresh) {
    e.respondWith(fetch(e.request).then((res) => {
      if (cacheable(url, res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(isPage ? './index.html' : e.request, copy)) }
      return res
    }).catch(() => caches.match(e.request).then((hit) => hit || (isPage ? caches.match('./index.html') : Response.error()))))
    return
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (cacheable(url, res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)) }
      return res
    })),
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
