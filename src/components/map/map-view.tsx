// MapLab Studio — central MapLibre map.
// This is the rendering surface. It loads the active basemap from BASEMAPS,
// registers the shared PMTiles protocol once, then layers the user's
// sources/layers on top of the basemap. It also wires up bidirectional view
// syncing with the Zustand store and dispatches feature clicks to
// `selectLayer`.

'use client'

import * as React from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Loader2 } from 'lucide-react'

import { getPmTilesProtocol } from '@/lib/pmtiles-helpers'
import { BASEMAPS } from '@/lib/defaults'
import { useMapLabStore } from '@/lib/map-store'
import type { LayerSpec, MapStyle, SourceSpec } from '@/lib/types'

// Module-level PMTiles protocol registration (singleton — survives HMR
// reloads and unmounts so we don't re-add it on every MapView mount).
let _protocolRegistered = false
const _pmtilesProtocol = getPmTilesProtocol()
function ensurePmTilesProtocol() {
  if (_protocolRegistered) return
  // pmtiles v4 API: `new Protocol()` exposes a `.tile` function which
  // MapLibre's addProtocol expects.
  try {
    maplibregl.addProtocol('pmtiles', _pmtilesProtocol.tile)
  } catch {
    // ignore if already registered
  }
  _protocolRegistered = true
}

// ---------------------------------------------------------------------------
// Map context — exposes the live maplibre.Map instance to children
// (DrawControl, MapControls) without prop-drilling.
// ---------------------------------------------------------------------------
const MapContext = React.createContext<maplibregl.Map | null>(null)
export function useMap(): maplibregl.Map | null {
  return React.useContext(MapContext)
}

// ---------------------------------------------------------------------------
// Style conversion helpers (parallel to src/lib/map-style.ts but tuned for
// live addSource/addLayer calls rather than full-document export).
// ---------------------------------------------------------------------------
function buildSourceObject(src: SourceSpec): Record<string, unknown> {
  const out: Record<string, unknown> = { type: src.type }
  if (src.type === 'geojson') {
    out.data = src.data ?? { type: 'FeatureCollection', features: [] }
    if (src.maxzoom != null) out.maxzoom = src.maxzoom
  } else if (
    src.type === 'vector' ||
    src.type === 'raster' ||
    src.type === 'raster-dem'
  ) {
    if (src.url) out.url = src.url
    else if (src.tiles) out.tiles = src.tiles
    if (src.tileSize != null) out.tileSize = src.tileSize
    if (src.attribution) out.attribution = src.attribution
    if (src.maxzoom != null) out.maxzoom = src.maxzoom
    if (src.minzoom != null) out.minzoom = src.minzoom
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
  const layout: Record<string, unknown> = { ...layer.layout }
  layout.visibility = layer.visible ? 'visible' : 'none'
  out.layout = layout
  out.paint = { ...layer.paint }
  return out
}

// Small numeric helper for view-sync comparisons.
function approxEq(a: number, b: number, eps = 1e-7) {
  return Math.abs(a - b) < eps
}

// ---------------------------------------------------------------------------
// MapView component
// ---------------------------------------------------------------------------
export function MapView({ children }: { children?: React.ReactNode }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<maplibregl.Map | null>(null)
  // Ordered list of user layer ids currently on the map (render order).
  const userLayersOrderedRef = React.useRef<string[]>([])
  const userSourceIdsRef = React.useRef<Set<string>>(new Set())
  // Guards against feedback loops when we synchronously move the map in
  // response to a store change.
  const isExternalUpdateRef = React.useRef(false)
  const debounceRef = React.useRef<number | null>(null)
  // Track the last basemapId we applied so we don't re-apply on mount.
  const appliedBasemapRef = React.useRef<string | null>(null)

  const [map, setMap] = React.useState<maplibregl.Map | null>(null)
  const [loading, setLoading] = React.useState(true)

  // ---- store selectors --------------------------------------------------
  const mapStyle = useMapLabStore((s) => s.mapStyle)
  const basemapId = useMapLabStore((s) => s.basemapId)
  const view = useMapLabStore((s) => s.view)
  const flyToTrigger = useMapLabStore((s) => s.flyToTrigger)
  const drawMode = useMapLabStore((s) => s.drawMode)
  const setView = useMapLabStore((s) => s.setView)
  const selectLayer = useMapLabStore((s) => s.selectLayer)
  const setSelectedFeature = useMapLabStore((s) => s.setSelectedFeature)
  const clearFlyTo = useMapLabStore((s) => s.clearFlyTo)

  // Keep the latest mapStyle in a ref so callbacks created during mount can
  // access it without re-running the mount effect.
  const mapStyleRef = React.useRef<MapStyle>(mapStyle)
  React.useEffect(() => {
    mapStyleRef.current = mapStyle
  }, [mapStyle])

  // ---- apply user sources + layers on top of the basemap ----------------
  // Indirection via a ref so applyUserStyle can self-reference without a
  // "used before declaration" error.
  const applyUserStyleRef = React.useRef<(style: MapStyle) => void>(
    () => {},
  )
  const applyUserStyle = React.useCallback((style: MapStyle) => {
    const m = mapRef.current
    if (!m) return
    if (!m.isStyleLoaded()) {
      // try again when the style is ready
      m.once('style.load', () => applyUserStyleRef.current(style))
      return
    }

    // 1. Remove all currently-installed user layers.
    for (const id of userLayersOrderedRef.current) {
      if (m.getLayer(id)) {
        try {
          m.removeLayer(id)
        } catch (e) {
          console.warn('removeLayer failed', id, e)
        }
      }
    }
    userLayersOrderedRef.current = []

    // 2. Remove orphaned user sources.
    for (const id of userSourceIdsRef.current) {
      if (m.getSource(id)) {
        try {
          m.removeSource(id)
        } catch (e) {
          console.warn('removeSource failed', id, e)
        }
      }
    }
    userSourceIdsRef.current.clear()

    // 3. Add all user sources (even if some layers are hidden — the task
    //    requires sources to be registered regardless).
    for (const src of style.sources) {
      try {
        m.addSource(src.id, buildSourceObject(src) as any)
        userSourceIdsRef.current.add(src.id)
      } catch (e) {
        console.warn('addSource failed', src.id, e)
      }
    }

    // 4. Add user layers in render order (lowest first). Skip background
    //    layers — when we have a basemap underneath, a user background layer
    //    with full opacity would obscure the entire basemap, so we treat the
    //    basemap itself as the background.
    const sorted = [...style.layers].sort((a, b) => a.order - b.order)
    for (const layer of sorted) {
      if (layer.type === 'background') continue
      try {
        m.addLayer(buildLayerObject(layer) as any)
        userLayersOrderedRef.current.push(layer.id)
      } catch (e) {
        console.warn('addLayer failed', layer.id, e)
      }
    }
  }, [])
  React.useEffect(() => {
    applyUserStyleRef.current = applyUserStyle
  }, [applyUserStyle])

  // ---- mount: register protocol + create map -----------------------------
  React.useEffect(() => {
    ensurePmTilesProtocol()
    if (!containerRef.current || mapRef.current) return

    const basemap = BASEMAPS.find((b) => b.id === basemapId) ?? BASEMAPS[0]
    appliedBasemapRef.current = basemap.id

    const m = new maplibregl.Map({
      container: containerRef.current,
      style: basemap.styleUrl,
      center: view.center,
      zoom: view.zoom,
      bearing: view.bearing,
      pitch: view.pitch,
      attributionControl: false,
      hash: false,
    })
    mapRef.current = m
    setMap(m)

    const onStyleLoad = () => {
      setLoading(false)
      // (Re)apply user sources/layers whenever the style finishes loading —
      // this covers both the initial load and subsequent basemap switches.
      applyUserStyle(mapStyleRef.current)
    }
    // MapLibre emits `style.load` (note: camelCase `style.load`, not the
    // legacy `style.load` event name; both are accepted but the typed event
    // name is `style.load`).
    m.on('style.load', onStyleLoad)

    // Loading indicator while a style is still loading.
    const onStyleLoading = () => setLoading(true)
    m.on('styleloading' as never, onStyleLoading as never)

    // Sync map movement back to the store (debounced 200ms). Skip when the
    // movement was triggered programmatically by the view-sync effect.
    const onMoveEnd = () => {
      if (isExternalUpdateRef.current) return
      const next = {
        center: [m.getCenter().lng, m.getCenter().lat] as [number, number],
        zoom: m.getZoom(),
        bearing: m.getBearing(),
        pitch: m.getPitch(),
      }
      const cur = useMapLabStore.getState().view
      // Skip if effectively unchanged — avoids feedback loops.
      if (
        approxEq(cur.center[0], next.center[0]) &&
        approxEq(cur.center[1], next.center[1]) &&
        approxEq(cur.zoom, next.zoom) &&
        approxEq(cur.bearing, next.bearing) &&
        approxEq(cur.pitch, next.pitch)
      ) {
        return
      }
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        setView(next)
      }, 200)
    }
    m.on('moveend', onMoveEnd)

    // Feature click → selectLayer + populate the Inspector with the clicked
    // feature's properties. Iterate top-down (reverse render order).
    // SKIP entirely when a draw mode is active — MapboxDraw handles the
    // clicks and we don't want to interfere with feature selection/drawing.
    const onClick = (e: maplibregl.MapMouseEvent) => {
      // If a draw mode is active, let MapboxDraw handle the click.
      const currentDrawMode = useMapLabStore.getState().drawMode
      if (currentDrawMode && currentDrawMode !== 'simple_select') return

      const ids = userLayersOrderedRef.current
      for (let i = ids.length - 1; i >= 0; i--) {
        const id = ids[i]
        if (!m.getLayer(id)) continue
        const vis = m.getLayoutProperty(id, 'visibility')
        if (vis === 'none') continue
        try {
          const feats = m.queryRenderedFeatures(e.point, { layers: [id] })
          if (feats.length > 0) {
            selectLayer(id)
            // Populate the selectedFeature for the Inspector. queryRenderedFeatures
            // returns maplibregl GeoJSONFeature objects — they carry `properties`,
            // `geometry`, `source`, `sourceLayer`, and an `id`.
            const f = feats[0]
            setSelectedFeature({
              layerId: id,
              featureId: f.id as string | number | undefined,
              properties: (f.properties ?? {}) as Record<string, unknown>,
              geometryType: (f.geometry?.type as string) ?? 'unknown',
              sourceLayer: f.sourceLayer as string | undefined,
            })
            return
          }
        } catch {
          // ignore
        }
      }
      // Click on empty area → clear the selected feature.
      setSelectedFeature(null)
    }
    m.on('click', onClick)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      m.off('style.load', onStyleLoad)
      m.off('styleloading' as never, onStyleLoading as never)
      m.off('moveend', onMoveEnd)
      m.off('click', onClick)
      m.remove()
      mapRef.current = null
      setMap(null)
    }
  }, [])

  // ---- re-apply user style when mapStyle changes -------------------------
  React.useEffect(() => {
    if (!mapRef.current) return
    applyUserStyle(mapStyle)
  }, [mapStyle, applyUserStyle])

  // ---- handle basemap changes -------------------------------------------
  React.useEffect(() => {
    const m = mapRef.current
    if (!m) return
    // Skip the very first run — the basemap is already set by the mount
    // effect. Subsequent changes switch the style.
    if (appliedBasemapRef.current === basemapId) return
    appliedBasemapRef.current = basemapId
    const basemap = BASEMAPS.find((b) => b.id === basemapId) ?? BASEMAPS[0]
    setLoading(true)
    // diff:false so we get a clean style swap; the style.load listener
    // will re-apply the user sources/layers on top.
    m.setStyle(basemap.styleUrl, { diff: false } as any)
  }, [basemapId])

  // ---- sync external view changes ---------------------------------------
  React.useEffect(() => {
    const m = mapRef.current
    if (!m) return
    // If the map's current view already matches the store, skip — this
    // happens after a user-driven move triggers setView in the store, and
    // we don't want to fight the user.
    const cur = {
      center: [m.getCenter().lng, m.getCenter().lat],
      zoom: m.getZoom(),
      bearing: m.getBearing(),
      pitch: m.getPitch(),
    }
    if (
      approxEq(cur.center[0], view.center[0]) &&
      approxEq(cur.center[1], view.center[1]) &&
      approxEq(cur.zoom, view.zoom) &&
      approxEq(cur.bearing, view.bearing) &&
      approxEq(cur.pitch, view.pitch)
    ) {
      return
    }
    isExternalUpdateRef.current = true
    m.jumpTo({
      center: view.center,
      zoom: view.zoom,
      bearing: view.bearing,
      pitch: view.pitch,
    })
    // Reset on the next microtask — jumpTo fires move/moveend synchronously.
    Promise.resolve().then(() => {
      isExternalUpdateRef.current = false
    })
  }, [view])

  // ---- handle flyTo trigger ---------------------------------------------
  React.useEffect(() => {
    const m = mapRef.current
    if (!m || !flyToTrigger) return
    m.flyTo({
      center: flyToTrigger.center,
      zoom: flyToTrigger.zoom ?? m.getZoom(),
    })
    clearFlyTo()
  }, [flyToTrigger, clearFlyTo])

  // ---- handle fitToData trigger -----------------------------------------
  const fitToDataTrigger = useMapLabStore((s) => s.fitToDataTrigger)
  React.useEffect(() => {
    if (fitToDataTrigger === 0) return // skip initial
    const m = mapRef.current
    if (!m) return
    const style = mapStyleRef.current
    let minLng = Infinity,
      minLat = Infinity,
      maxLng = -Infinity,
      maxLat = -Infinity
    let found = false
    for (const src of style.sources) {
      if (src.type !== 'geojson') continue
      const data = src.data
      if (!data || typeof data === 'string') continue
      const fc = data as GeoJSON.FeatureCollection
      for (const feat of fc.features ?? []) {
        const geom = feat.geometry
        if (!geom) continue
        // GeometryCollection has no `coordinates` — only visit geometries
        // that have a direct `coordinates` array.
        if (geom.type === 'GeometryCollection') continue
        const visit = (coords: number | number[] | number[][]) => {
          if (typeof coords === 'number') return
          if (typeof coords[0] === 'number') {
            const [lng, lat] = coords as number[]
            if (lng < minLng) minLng = lng
            if (lat < minLat) minLat = lat
            if (lng > maxLng) maxLng = lng
            if (lat > maxLat) maxLat = lat
            found = true
            return
          }
          for (const c of coords as number[][]) visit(c)
        }
        visit(geom.coordinates as unknown as number[])
      }
    }
    if (!found) return
    // Pad the bounds slightly so features aren't flush against the edge.
    const padLng = (maxLng - minLng) * 0.1 || 0.01
    const padLat = (maxLat - minLat) * 0.1 || 0.01
    m.fitBounds(
      [
        [minLng - padLng, minLat - padLat],
        [maxLng + padLng, maxLat + padLat],
      ],
      { padding: 40, maxZoom: 16 },
    )
  }, [fitToDataTrigger])

  // ---- handle resetView trigger -----------------------------------------
  // When the user clicks the Reset button in the status bar, fly the camera
  // back to the style's default view (center/zoom/bearing/pitch). The store
  // has already updated `view` to defaultView before bumping the trigger.
  const resetViewTrigger = useMapLabStore((s) => s.resetViewTrigger)
  React.useEffect(() => {
    if (resetViewTrigger === 0) return // skip initial
    const m = mapRef.current
    if (!m) return
    const v = useMapLabStore.getState().defaultView
    m.flyTo({
      center: v.center,
      zoom: v.zoom,
      bearing: v.bearing,
      pitch: v.pitch,
      duration: 600,
    })
  }, [resetViewTrigger])

  // ---- sync drawMode to a data attribute for CSS cursor override --------
  // MapboxDraw's JS cursor management can fail in MapLibre v5. This sets a
  // data attribute on the map container so our CSS rule can force the
  // crosshair cursor when a draw mode is active.
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const drawModes: string[] = ['draw_polygon', 'draw_line_string', 'draw_point']
    if (drawMode && drawModes.includes(drawMode)) {
      el.setAttribute('data-draw-mode', drawMode)
    } else {
      el.removeAttribute('data-draw-mode')
    }
  }, [drawMode])

  return (
    <MapContext.Provider value={map}>
      <div className="relative h-full w-full overflow-hidden bg-muted">
        <div ref={containerRef} className="h-full w-full" />
        {loading && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/40 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-foreground" />
          </div>
        )}
        {map && children}
      </div>
    </MapContext.Provider>
  )
}
