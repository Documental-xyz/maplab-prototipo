// MapLab Studio — basemap attribution bar.
// Renders the active basemap's attribution string in a small muted chip at
// the bottom-left of the map. MapLibre's built-in attribution control is
// disabled in MapView so we can render this consistent UI ourselves.

'use client'

import { BASEMAPS } from '@/lib/defaults'
import { useMapLabStore } from '@/lib/map-store'

export function MapAttribution() {
  const basemapId = useMapLabStore((s) => s.basemapId)
  const basemap = BASEMAPS.find((b) => b.id === basemapId) ?? BASEMAPS[0]
  return (
    <a
      href="https://openstreetmap.org/copyright"
      target="_blank"
      rel="noopener noreferrer"
      className="absolute bottom-4 left-4 z-10 max-w-[60%] truncate rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm hover:bg-background/95 hover:text-foreground"
      title={basemap.attribution}
    >
      © {basemap.attribution}
    </a>
  )
}
