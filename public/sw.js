const CACHE = 'cifrasgroup-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

// network-first com fallback pro cache: sempre tenta a versão mais nova,
// mas o app continua funcionando offline com o que já foi visitado
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fetch(e.request)
        if (res.ok) cache.put(e.request, res.clone())
        return res
      } catch {
        const cached = await cache.match(e.request)
        if (cached) return cached
        throw new Error('offline e sem versão em cache para ' + e.request.url)
      }
    }),
  )
})
