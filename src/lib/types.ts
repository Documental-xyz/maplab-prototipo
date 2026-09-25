// MapLab Studio — core type definitions
// Aligned with the MapLibre / Mapbox Style Specification v8

export type LayerType =
  | 'fill'
  | 'line'
  | 'symbol'
  | 'circle'
  | 'raster'
  | 'fill-extrusion'
  | 'background'
  | 'heatmap'
  | 'hillshade'

export type SourceType =
  | 'vector'
  | 'raster'
  | 'raster-dem'
  | 'geojson'
  | 'image'
  | 'video'

export interface SourceSpec {
  id: string
  name: string
  type: SourceType
  // For vector/raster/dem: PMTiles URL (pmtiles://) or TileJSON URL or tiles[]
  url?: string
  tiles?: string[]
  tileSize?: number
  attribution?: string
  maxzoom?: number
  minzoom?: number
  // For geojson: inline GeoJSON FeatureCollection
  data?: GeoJSON.FeatureCollection | string
  encoding?: 'raw' | 'topojson'
}

export interface LayerSpec {
  id: string
  name: string
  type: LayerType
  // null only for `background` layers
  sourceId: string | null
  sourceLayer?: string
  paint: Record<string, unknown>
  layout: Record<string, unknown>
  filter?: unknown[] | null
  minzoom?: number
  maxzoom?: number
  visible: boolean
  order: number
}

export interface MapView {
  center: [number, number] // [lng, lat]
  zoom: number
  bearing: number
  pitch: number
}

export interface MapStyle {
  id: string
  name: string
  version: 8
  sources: SourceSpec[]
  layers: LayerSpec[]
  view: MapView
  sprite?: string
  glyphs?: string
}

export type PanelId =
  | 'maps'
  | 'data'
  | 'styles'
  | 'tiles'
  | 'search'
  | 'routing'
  | 'api'
  | 'layers'
  | 'inspector'

export type DrawMode =
  | 'simple_select'
  | 'direct_select'
  | 'draw_polygon'
  | 'draw_line_string'
  | 'draw_point'
  | null

export interface Basemap {
  id: string
  name: string
  // URL to a MapLibre/Mapbox style JSON, or 'pmtiles://...'
  styleUrl: string
  preview: string
  attribution: string
  category: 'osm' | 'satellite' | 'terrain' | 'light' | 'dark' | 'plain'
}

// Mapbox Style Spec compatible document (the export format)
export interface MapboxStyleDoc {
  version: 8
  name: string
  metadata?: Record<string, unknown>
  sources: Record<string, unknown>
  layers: unknown[]
  sprite?: string
  glyphs?: string
  center?: [number, number]
  zoom?: number
  bearing?: number
  pitch?: number
  transition?: Record<string, unknown>
}
