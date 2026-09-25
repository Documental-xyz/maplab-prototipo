'use client'

// MapLab Studio — "Routing" panel.
// Plan a route between two coordinates and report distance/duration.
// For MVP we GET /api/route-plan and toast the summary + fly to the
// midpoint (no permanent route layer is rendered).

import * as React from 'react'
import {
  Navigation,
  Loader2,
  MapPin,
  Crosshair,
  ArrowRight,
  Route as RouteIcon,
  Car,
  Footprints,
  Bike,
} from 'lucide-react'
import { toast } from 'sonner'
import { useMapLabStore } from '@/lib/map-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Profile = 'driving' | 'walking' | 'cycling'

function PanelHeader({ title }: { title: string }) {
  return (
    <header className="px-4 pt-4 pb-2">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
    </header>
  )
}

function parseCoord(s: string): [number, number] | null {
  const parts = s
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length !== 2) return null
  const lat = parseFloat(parts[0]!)
  const lng = parseFloat(parts[1]!)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return [lat, lng]
}

interface RouteSummary {
  distance?: number // km
  duration?: number // min
  geometry?: GeoJSON.LineString | null
  error?: string
}

export function RoutingPanel() {
  const view = useMapLabStore((s) => s.view)
  const flyTo = useMapLabStore((s) => s.flyTo)
  const pushToast = useMapLabStore((s) => s.pushToast)

  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [profile, setProfile] = React.useState<Profile>('driving')
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<RouteSummary | null>(null)

  const fillMapCenter = (which: 'from' | 'to') => {
    const [lat, lng] = view.center.slice().reverse() as [number, number]
    // view.center is [lng, lat]; the input uses lat,lng.
    const v = `${lat.toFixed(5)},${lng.toFixed(5)}`
    if (which === 'from') setFrom(v)
    else setTo(v)
  }

  const calc = async () => {
    const f = parseCoord(from)
    const t = parseCoord(to)
    if (!f) {
      toast.error('Invalid From coordinates', {
        description: 'Use the format lat,lng (e.g. 64.146,-21.942)',
      })
      return
    }
    if (!t) {
      toast.error('Invalid To coordinates', {
        description: 'Use the format lat,lng (e.g. 64.146,-21.942)',
      })
      return
    }

    setBusy(true)
    setResult(null)
    try {
      const res = await fetch(
        `/api/route-plan?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&profile=${profile}`,
        { headers: { Accept: 'application/json' } },
      )
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = (await res.json()) as RouteSummary
      if (data.error) {
        throw new Error(data.error)
      }
      setResult(data)

      const dist = typeof data.distance === 'number' ? data.distance.toFixed(2) : '?'
      const dur =
        typeof data.duration === 'number'
          ? Math.round(data.duration)
          : '?'
      pushToast(`Route: ${dist} km · ${dur} min`, 'success')

      // fly to the midpoint of the two endpoints (lat,lng -> [lng,lat])
      const midLat = (f[0] + t[0]) / 2
      const midLng = (f[1] + t[1]) / 2
      flyTo([midLng, midLat], 11)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('Routing failed', { description: msg })
      setResult({ error: msg })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Routing" />
      <ScrollArea className="flex-1 max-h-[calc(100vh-7rem)]">
        <div className="flex flex-col gap-3 px-4 pb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="route-from">From</Label>
              <button
                type="button"
                onClick={() => fillMapCenter('from')}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Crosshair className="size-3" />
                Use map center
              </button>
            </div>
            <Input
              id="route-from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="lat,lng"
              className="font-mono text-xs h-10"
              inputMode="decimal"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="route-to">To</Label>
              <button
                type="button"
                onClick={() => fillMapCenter('to')}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Crosshair className="size-3" />
                Use map center
              </button>
            </div>
            <Input
              id="route-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="lat,lng"
              className="font-mono text-xs h-10"
              inputMode="decimal"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="route-profile">Profile</Label>
            <Select
              value={profile}
              onValueChange={(v) => setProfile(v as Profile)}
            >
              <SelectTrigger id="route-profile" className="h-10">
                <SelectValue placeholder="Profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="driving">
                  <span className="flex items-center gap-2">
                    <Car className="size-3.5" /> Driving
                  </span>
                </SelectItem>
                <SelectItem value="walking">
                  <span className="flex items-center gap-2">
                    <Footprints className="size-3.5" /> Walking
                  </span>
                </SelectItem>
                <SelectItem value="cycling">
                  <span className="flex items-center gap-2">
                    <Bike className="size-3.5" /> Cycling
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={calc}
            disabled={busy}
            className="h-11"
            variant="default"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RouteIcon className="size-4" />
            )}
            Calculate route
          </Button>

          {result && (
            <div
              className={cn(
                'rounded-md border p-3',
                result.error
                  ? 'border-destructive/40 bg-destructive/5'
                  : 'border-primary/40 bg-primary/5',
              )}
            >
              {result.error ? (
                <p className="text-xs text-destructive">{result.error}</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Navigation className="size-4 text-primary" />
                    <span className="text-sm font-semibold">Route summary</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-background/60 p-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Distance
                      </div>
                      <div className="text-base font-semibold font-mono">
                        {typeof result.distance === 'number'
                          ? result.distance.toFixed(2)
                          : '?'}{' '}
                        <span className="text-xs font-normal">km</span>
                      </div>
                    </div>
                    <div className="rounded-md bg-background/60 p-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Duration
                      </div>
                      <div className="text-base font-semibold font-mono">
                        {typeof result.duration === 'number'
                          ? Math.round(result.duration)
                          : '?'}{' '}
                        <span className="text-xs font-normal">min</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <MapPin className="size-3" />
                    <span className="font-mono">
                      {from} <ArrowRight className="inline size-3" /> {to}
                    </span>
                    <Badge variant="outline" className="ml-1 text-[10px]">
                      {profile}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="rounded-md border border-dashed border-border p-3 text-[11px] text-muted-foreground">
            <p className="font-medium mb-1">Tip</p>
            Coordinates use the <code className="font-mono">lat,lng</code> order.
            Use the OSRM-style endpoint <code className="font-mono">/api/route-plan</code> for
            custom integrations.
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
