// MapLab Studio — server-side style serialization helpers.
//
// These helpers convert between the internal `MapStyle` model (used by the
// Zustand store and the UI) and the Prisma `Style` row. The full MapLibre
// style JSON is stored as text in `Style.spec` because SQLite primitives
// cannot hold nested objects / lists.
//
// `map-style.ts` is pure (no 'use client'), so `toMapboxStyle` is also safe
// to import here for the export endpoint.

import { toMapboxStyle } from '@/lib/map-style'
import type { MapStyle } from '@/lib/types'
import { createDefaultStyle } from '@/lib/defaults'
import type { Style as PrismaStyleRow } from '@prisma/client'

// Serialize a MapStyle to a JSON string for storage in `Style.spec`.
export function serializeStyle(s: MapStyle): string {
  return JSON.stringify(s)
}

// Parse a stored `Style.spec` string back into a MapStyle.
// Falls back to a fresh `createDefaultStyle()` if the payload is invalid
// or missing critical fields.
export function deserializeStyle(raw: string | null | undefined, id: string): MapStyle {
  if (!raw) {
    const def = createDefaultStyle()
    def.id = id
    return def
  }
  try {
    const parsed = JSON.parse(raw) as Partial<MapStyle>
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('invalid style JSON')
    }
    const def = createDefaultStyle()
    return {
      id: parsed.id ?? id,
      name: parsed.name ?? def.name,
      version: 8,
      sources: Array.isArray(parsed.sources) ? parsed.sources : def.sources,
      layers: Array.isArray(parsed.layers) ? parsed.layers : def.layers,
      view: {
        center:
          parsed.view && Array.isArray(parsed.view.center)
            ? (parsed.view.center as [number, number])
            : def.view.center,
        zoom: parsed.view?.zoom ?? def.view.zoom,
        bearing: parsed.view?.bearing ?? def.view.bearing,
        pitch: parsed.view?.pitch ?? def.view.pitch,
      },
      sprite: parsed.sprite ?? def.sprite,
      glyphs: parsed.glyphs ?? def.glyphs,
    }
  } catch {
    const def = createDefaultStyle()
    def.id = id
    return def
  }
}

// Map a Prisma `Style` row to the internal `MapStyle` model.
// If the spec doesn't carry view fields (older rows), fall back to the
// denormalized `centerLng/centerLat/zoom/bearing/pitch` columns.
export function prismaStyleToMapStyle(row: PrismaStyleRow): MapStyle {
  const parsed = deserializeStyle(row.spec, row.id)
  // Backfill view from denormalized columns when spec is silent.
  if (row.centerLng != null && row.centerLat != null) {
    // Only override when spec view center is missing/zero AND row has values.
    if (
      !parsed.view.center ||
      (parsed.view.center[0] === 0 && parsed.view.center[1] === 0)
    ) {
      parsed.view.center = [row.centerLng, row.centerLat]
    }
  }
  if (parsed.view.zoom == null || parsed.view.zoom === 0) {
    if (row.zoom != null) parsed.view.zoom = row.zoom
  }
  if (parsed.view.bearing == null) {
    if (row.bearing != null) parsed.view.bearing = row.bearing
  }
  if (parsed.view.pitch == null) {
    if (row.pitch != null) parsed.view.pitch = row.pitch
  }
  // Always prefer the row's name if the spec didn't carry one.
  if (!parsed.name || parsed.name === 'MapLab Default Style') {
    parsed.name = row.name
  }
  return parsed
}

// Build the Prisma `create`/`update` data payload for a Style row.
// Stores the full MapStyle JSON in `spec`, and derives denormalized
// view columns (centerLng, centerLat, zoom, bearing, pitch) from spec.view.
export function mapStyleToPrismaData(
  s: MapStyle,
  projectId: string,
): {
  name: string
  projectId: string
  spec: string
  version: number
  centerLng: number
  centerLat: number
  zoom: number
  bearing: number
  pitch: number
} {
  const [lng, lat] = s.view.center
  return {
    name: s.name,
    projectId,
    spec: serializeStyle(s),
    version: 8,
    centerLng: lng,
    centerLat: lat,
    zoom: s.view.zoom,
    bearing: s.view.bearing,
    pitch: s.view.pitch,
  }
}

// Re-export `toMapboxStyle` so the export endpoint can stay coupled to a
// single server-side module (and so we can swap implementations later).
export { toMapboxStyle as serverToMapboxStyle }
