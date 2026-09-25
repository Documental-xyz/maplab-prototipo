'use client'

// MapLab Studio — stale-while-revalidate fetch hook.
// Returns the cached data immediately (if available), then re-fetches in the
// background and updates when the fresh data arrives. Avoids the flash of
// "Loading…" when switching between panels that already have data cached.
//
// Usage:
//   const { data, loading, error, reload } = useSWR<SavedProject[]>(
//     project.id === 'default' ? null : `/api/projects/${project.id}/datasets`,
//   )
//
// Pass `null` as the key to skip fetching (e.g. when the project isn't saved
// yet). The hook deduplicates by key — multiple components using the same
// key share the same cache entry.

import * as React from 'react'

// Module-level cache: key -> { data, timestamp }
const cache = new Map<string, { data: unknown; timestamp: number }>()
// Module-level in-flight requests: key -> Promise<unknown>
const inflight = new Map<string, Promise<unknown>>()
// Max age before a cache entry is considered stale (5 minutes).
const MAX_AGE_MS = 5 * 60 * 1000

interface SWRState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useSWR<T>(key: string | null): SWRState<T> {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [bump, setBump] = React.useState(0)

  const reload = React.useCallback(() => setBump((n) => n + 1), [])

  React.useEffect(() => {
    if (!key) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    // 1. If we have a cached entry, show it immediately (stale).
    const cached = cache.get(key)
    if (cached) {
      setData(cached.data as T)
    }

    // 2. Determine if we need to re-fetch.
    const isStale =
      !cached || Date.now() - cached.timestamp > MAX_AGE_MS || bump > 0
    if (!isStale) return

    // 3. Deduplicate — if there's already an in-flight request for this key,
    //    attach to it instead of starting a new one.
    setLoading(true)
    setError(null)

    let promise = inflight.get(key)
    if (!promise) {
      promise = fetch(key)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return await res.json()
        })
        .catch((e) => {
          // Remove from in-flight on error so a retry can start.
          inflight.delete(key)
          throw e
        })
        .finally(() => {
          inflight.delete(key)
        })
      inflight.set(key, promise)
    }

    promise
      .then((json) => {
        cache.set(key, { data: json, timestamp: Date.now() })
        setData(json as T)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [key, bump])

  return { data, loading, error, reload }
}

// Clear the entire SWR cache (e.g. when the user clears local cache in
// Settings, or when a project is deleted).
export function clearSWRCache() {
  cache.clear()
  inflight.clear()
}
