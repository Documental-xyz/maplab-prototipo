// MapLab Studio Service Worker
// Provides offline support for the PWA shell. Map tiles themselves are not
// cached (they're huge) — only the app shell and static assets.

const CACHE_VERSION = 'maplab-v1'
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // Only handle GET.
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Same-origin only — never cache cross-origin tile/style/glyph requests
  // (those are huge and should always be live).
  if (url.origin !== self.location.origin) return

  // Skip Next.js dev HMR / API calls.
  if (url.pathname.startsWith('/_next/webpack-hmr')) return
  if (url.pathname.startsWith('/api/')) {
    // Network-first for API calls.
    event.respondWith(fetch(req).catch(() => caches.match(req)))
    return
  }

  // App shell: cache-first with background revalidation.
  if (
    url.pathname === '/' ||
    APP_SHELL.includes(url.pathname) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const clone = res.clone()
              caches.open(CACHE_VERSION).then((c) => c.put(req, clone))
            }
            return res
          })
          .catch(() => cached)
        return cached || fetchPromise
      }),
    )
  }
})
