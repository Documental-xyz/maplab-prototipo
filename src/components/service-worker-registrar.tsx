'use client'

// MapLab Studio — PWA service worker registration (client-only).

import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // Don't register in development to avoid caching the dev server.
    // (Next.js dev HMR + SW is fragile.)
    if (process.env.NODE_ENV === 'development') return

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          console.warn('SW registration failed:', err)
        })
    }

    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)

    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}
