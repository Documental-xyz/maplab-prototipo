// MapLab Studio — MapLibre/Mapbox Style Spec conversion helpers.
// These convert our internal MapStyle model into a strict Mapbox v8 style doc
// (the format MapLibre GL consumes and that Mapbox Studio can import).

import type {
  LayerSpec,
  MapStyle,
  MapboxStyleDoc,
  SourceSpec,
} from './types'

function buildSourceObject(src: SourceSpec): Record<string, unknown> {
  const out: Record<string, unknown> = { type: src.type }
  if (src.type === 'geojson') {
    out.data = src.data ?? { type: 'FeatureCollection', features: [] }
    if (src.maxzoom != null) out.maxzoom = src.maxzoom
  } else if (src.type === 'vector' || src.type === 'raster' || src.type === 'raster-dem') {
    if (src.url) out.url = src.url
    else if (src.tiles) out.tiles = src.tiles
    if (src.tileSize != null) out.tileSize = src.tileSize
    if (src.attribution) out.attribution = src.attribution
    if (src.maxzoom != null) out.maxzoom = src.maxzoom
    if (src.minzoom != null) out.minzoom = src.minzoom
  } else if (src.type === 'image') {
    if (src.url) out.url = src.url
    // image sources require `coordinates` (3-point affine); not yet modeled in
    // our internal SourceSpec — left as a future extension.
  }
  return out
}

function buildLayerObject(layer: LayerSpec): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: layer.id,
    type: layer.type,
  }
  if (layer.sourceId) {
    out.source = layer.sourceId
    if (layer.sourceLayer) out['source-layer'] = layer.sourceLayer
  }
  if (layer.minzoom != null) out.minzoom = layer.minzoom
  if (layer.maxzoom != null) out.maxzoom = layer.maxzoom
  if (layer.filter && Array.isArray(layer.filter) && layer.filter.length > 0) {
    out.filter = layer.filter
  }
  // Layout — include `visibility` based on our `visible` flag.
  const layout: Record<string, unknown> = { ...layer.layout }
  layout.visibility = layer.visible ? 'visible' : 'none'
  out.layout = layout
  // Paint properties.
  out.paint = { ...layer.paint }
  // Metadata for round-tripping the display name back into Mapbox Studio.
  out.metadata = { 'maplab:layer-name': layer.name }
  return out
}

// Convert internal MapStyle to a Mapbox v8 style doc consumable by MapLibre.
export function toMapboxStyle(style: MapStyle): MapboxStyleDoc {
  const sources: Record<string, unknown> = {}
  for (const src of style.sources) {
    sources[src.id] = buildSourceObject(src)
  }
  // Layers in render order (we keep `order` ascending).
  const ordered = [...style.layers].sort((a, b) => a.order - b.order)
  const layers = ordered.map(buildLayerObject)
  return {
    version: 8,
    name: style.name,
    metadata: {
      'maplab:project': style.id,
      'maplab:generated': new Date().toISOString(),
    },
    sources,
    layers,
    sprite: style.sprite || undefined,
    glyphs: style.glyphs || undefined,
    center: style.view.center,
    zoom: style.view.zoom,
    bearing: style.view.bearing,
    pitch: style.view.pitch,
  }
}

// Re-import a Mapbox style doc into our internal MapStyle model.
// Useful for "Import Mapbox style" feature in the future.
export function fromMapboxStyle(
  doc: MapboxStyleDoc & { sources?: Record<string, any> },
  id: string,
): MapStyle {
  const sources: SourceSpec[] = []
  const rawSources = doc.sources ?? {}
  for (const [sid, raw] of Object.entries(rawSources)) {
    sources.push({
      id: sid,
      name: sid,
      type: (raw.type as SourceSpec['type']) ?? 'geojson',
      url: raw.url,
      tiles: raw.tiles,
      tileSize: raw.tileSize,
      attribution: raw.attribution,
      maxzoom: raw.maxzoom,
      minzoom: raw.minzoom,
      data: raw.data,
    })
  }
  const layers: LayerSpec[] = (doc.layers ?? []).map((raw: any, i: number) => ({
    id: raw.id as string,
    name: (raw.metadata?.['maplab:layer-name'] as string) ?? (raw.id as string),
    type: raw.type as LayerSpec['type'],
    sourceId: raw.source ?? null,
    sourceLayer: raw['source-layer'],
    paint: raw.paint ?? {},
    layout: (() => {
      const { visibility: _v, ...rest } = raw.layout ?? {}
      return rest
    })(),
    filter: raw.filter ?? null,
    minzoom: raw.minzoom,
    maxzoom: raw.maxzoom,
    visible: (raw.layout?.visibility ?? 'visible') === 'visible',
    order: i,
  }))
  return {
    id,
    name: doc.name ?? 'Imported style',
    version: 8,
    sources,
    layers,
    view: {
      center: (doc.center as [number, number]) ?? [0, 0],
      zoom: doc.zoom ?? 1,
      bearing: doc.bearing ?? 0,
      pitch: doc.pitch ?? 0,
    },
    sprite: doc.sprite,
    glyphs: doc.glyphs,
  }
}

// Quick helpers for filter expressions.
export function buildEqualsFilter(field: string, value: unknown): unknown[] {
  return ['==', ['get', field], value] as unknown as unknown[]
}
