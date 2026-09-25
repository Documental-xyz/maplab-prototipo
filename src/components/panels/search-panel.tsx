'use client'

// MapLab Studio — "Search" panel.
// Geocode place names via GET /api/search?q= and fly the map to a result.

import * as React from 'react'
import { Search, Loader2, MapPin, Navigation, X } from 'lucide-react'
import { toast } from 'sonner'
import { useMapLabStore } from '@/lib/map-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface SearchResult {
  place_id?: number
  display_name: string
  lat: string
  lon: string
  type?: string
  class?: string
  boundingbox?: [string, string, string, string]
}

function PanelHeader({ title }: { title: string }) {
  return (
    <header className="px-4 pt-4 pb-2">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
    </header>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Search className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">Search for places</p>
      <p className="text-xs text-muted-foreground max-w-[18rem]">
        Search by place name, address, or coordinates (lat,lng).
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-2 px-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-md border p-3">
          <Skeleton className="size-8 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ResultRow({
  result,
  onPick,
}: {
  result: SearchResult
  onPick: (r: SearchResult) => void
}) {
  const lat = parseFloat(result.lat)
  const lon = parseFloat(result.lon)
  const name = result.display_name || 'Unnamed place'
  // Truncate display name to ~80 chars for layout stability.
  const shortName = name.length > 80 ? name.slice(0, 80) + '…' : name
  // Split into primary + secondary (comma separated by Nominatim).
  const parts = name.split(',')
  const primary = parts[0]?.trim() || shortName
  const secondary = parts.slice(1).join(',').trim()
  return (
    <div className="group flex items-start gap-2 rounded-md border border-border p-3 hover:bg-accent transition-colors min-h-11">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <MapPin className="size-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{primary}</p>
        {secondary && (
          <p className="text-[11px] text-muted-foreground truncate">
            {secondary}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
          {lat.toFixed(4)}, {lon.toFixed(4)}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 shrink-0"
        onClick={() => onPick(result)}
        aria-label={`Fly to ${primary}`}
      >
        <Navigation className="size-3.5" />
        Fly to
      </Button>
    </div>
  )
}

export function SearchPanel() {
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [hasSearched, setHasSearched] = React.useState(false)
  const flyTo = useMapLabStore((s) => s.flyTo)
  const pushToast = useMapLabStore((s) => s.pushToast)

  const doSearch = React.useCallback(
    async (q: string) => {
      if (!q.trim()) {
        toast.error('Type something to search for')
        return
      }
      setLoading(true)
      setHasSearched(true)
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q.trim())}`,
          { headers: { Accept: 'application/json' } },
        )
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const data = (await res.json()) as SearchResult[] | { error?: string }
        if (Array.isArray(data)) {
          setResults(data)
          if (data.length === 0) {
            pushToast('No results', 'info')
          } else {
            pushToast(`Found ${data.length} results`, 'success')
          }
        } else {
          throw new Error(data.error || 'Bad response')
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        toast.error('Search failed', { description: msg })
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [pushToast],
  )

  const onPick = React.useCallback(
    (r: SearchResult) => {
      const lat = parseFloat(r.lat)
      const lon = parseFloat(r.lon)
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        toast.error('Could not parse coordinates')
        return
      }
      // flyTo expects [lng, lat] (MapLibre convention).
      flyTo([lon, lat], 14)
      pushToast(`Flying to ${r.display_name.split(',')[0]}`, 'info')
    },
    [flyTo, pushToast],
  )

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doSearch(query)
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Place search" />
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 px-4 pb-2"
        role="search"
      >
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a place…"
            className={cn('pl-8 h-10')}
            aria-label="Search query"
            enterKeyHint="search"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('')
                setResults([])
                setHasSearched(false)
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Button type="submit" disabled={loading} className="h-10 px-4">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          <span className="hidden sm:inline">Search</span>
        </Button>
      </form>

      <ScrollArea className="flex-1 max-h-[calc(100vh-12rem)]">
        <div className="px-4 pb-4">
          {loading ? (
            <LoadingState />
          ) : results.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-2">
              {results.map((r, i) => (
                <ResultRow
                  key={r.place_id ?? i}
                  result={r}
                  onPick={onPick}
                />
              ))}
            </div>
          )}
          {!loading && hasSearched && results.length === 0 && (
            <p className="px-4 pt-2 text-xs text-muted-foreground text-center">
              No results found. Try a different query.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
