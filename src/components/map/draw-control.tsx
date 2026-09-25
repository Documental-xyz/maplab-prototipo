// MapLab Studio — drawing toolbar.
// Wraps @mapbox/mapbox-gl-draw (compatible with MapLibre GL) and stores a
// snapshot of every drawn feature into a separate `__drawn` GeoJSON source
// so the user can recover drawings across basemap switches. The source is
// not part of the user's mapStyle — it lives only on the live map.

'use client'

import * as React from 'react'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import type { GeoJSONSource, Map as MaplibreMap } from 'maplibre-gl'
import { Trash2 } from 'lucide-react'

import { useMap } from './map-view'
import { useMapLabStore } from '@/lib/map-store'
import { Button } from '@/components/ui/button'
import type { DrawMode } from '@/lib/types'

// Internal source + layer ids for the persistent drawing snapshot.
const SRC_ID = '__drawn'
const LAYER_FILL = '__drawn-fill'
const LAYER_LINE = '__drawn-line'
const LAYER_CIRCLE = '__drawn-circle'

const SNAPSHOT_PAINT = {
  fill: {
    'fill-color': '#e8743b',
    'fill-opacity': 0.25,
  },
  line: {
    'line-color': '#e8743b',
    'line-width': 2,
    'line-opacity': 0.9,
  },
  circle: {
    'circle-radius': 6,
    'circle-color': '#e4192b',
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 2,
  },
}

function applyDrawMode(draw: MapboxDraw, mode: DrawMode, map?: MaplibreMap) {
  try {
    if (mode === null) {
      draw.deleteAll()
      draw.changeMode('simple_select')
      // Re-enable double-click zoom when not drawing.
      if (map) {
        try {
          map.doubleClickZoom.enable()
        } catch {
          // ignore
        }
      }
      return
    }
    // Disable double-click zoom while drawing (otherwise double-clicking
    // to finish a polygon would also zoom the map).
    if (map) {
      try {
        map.doubleClickZoom.disable()
      } catch {
        // ignore
      }
    }
    // The mapbox-gl-draw types have very narrow overloads for changeMode;
    // cast to satisfy TS while keeping runtime behaviour identical.
    draw.changeMode(mode as unknown as 'simple_select')
  } catch (e) {
    console.warn('draw.changeMode failed', e)
  }
}

export function DrawControl() {
  const map = useMap()
  const drawRef = React.useRef<MapboxDraw | null>(null)
  const drawnFeaturesRef = React.useRef<GeoJSON.FeatureCollection>({
    type: 'FeatureCollection',
    features: [],
  })

  const drawMode = useMapLabStore((s) => s.drawMode)
  const setDrawMode = useMapLabStore((s) => s.setDrawMode)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const mapStyle = useMapLabStore((s) => s.mapStyle)

  const refreshSource = React.useCallback(() => {
    const m = map
    if (!m) return
    const src = m.getSource(SRC_ID) as
      | (GeoJSONSource & { setData: (d: unknown) => void })
      | undefined
    if (src && typeof src.setData === 'function') {
      try {
        src.setData(drawnFeaturesRef.current)
      } catch (e) {
        console.warn('setData failed', e)
      }
    }
  }, [map])

  // ---- setup + teardown, re-runs on basemap (style) changes -------------
  React.useEffect(() => {
    if (!map) return
    let disposed = false
    const listeners: {
      create?: (e: { features?: GeoJSON.Feature[] }) => void
      delete?: (e: { features?: GeoJSON.Feature[] }) => void
    } = {}

    const disposeDraw = () => {
      // The map instance may already be destroyed when this cleanup runs
      // (e.g., on basemap switch or unmount). Wrap everything defensively.
      try {
        if (listeners.create) map.off('draw.create' as never, listeners.create as never)
      } catch {
        // map gone
      }
      try {
        if (listeners.delete) map.off('draw.delete' as never, listeners.delete as never)
      } catch {
        // map gone
      }
      if (drawRef.current) {
        try {
          map.removeControl(drawRef.current as never)
        } catch {
          // already removed / map gone
        }
        drawRef.current = null
      }
      for (const id of [LAYER_FILL, LAYER_LINE, LAYER_CIRCLE]) {
        try {
          if (map.getLayer(id)) {
            try {
              map.removeLayer(id)
            } catch {
              // ignore
            }
          }
        } catch {
          // map gone — skip
        }
      }
      try {
        if (map.getSource(SRC_ID)) {
          try {
            map.removeSource(SRC_ID)
          } catch {
            // ignore
          }
        }
      } catch {
        // map gone — skip
      }
    }

    const initDraw = () => {
      if (disposed || drawRef.current) return

      // 1. Persistent snapshot source + 3 geometry-specific layers.
      if (!map.getSource(SRC_ID)) {
        try {
          map.addSource(SRC_ID, {
            type: 'geojson',
            data: drawnFeaturesRef.current,
          } as any)
        } catch (e) {
          console.warn('addSource __drawn failed', e)
        }
      }
      if (!map.getLayer(LAYER_FILL)) {
        try {
          map.addLayer({
            id: LAYER_FILL,
            type: 'fill',
            source: SRC_ID,
            filter: ['==', ['geometry-type'], 'Polygon'] as never,
            paint: SNAPSHOT_PAINT.fill,
          } as never)
        } catch {
          // ignore
        }
      }
      if (!map.getLayer(LAYER_LINE)) {
        try {
          map.addLayer({
            id: LAYER_LINE,
            type: 'line',
            source: SRC_ID,
            filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']] as never,
            paint: SNAPSHOT_PAINT.line,
          } as never)
        } catch {
          // ignore
        }
      }
      if (!map.getLayer(LAYER_CIRCLE)) {
        try {
          map.addLayer({
            id: LAYER_CIRCLE,
            type: 'circle',
            source: SRC_ID,
            filter: ['==', ['geometry-type'], 'Point'] as never,
            paint: SNAPSHOT_PAINT.circle,
          } as never)
        } catch {
          // ignore
        }
      }

      // 2. The actual draw control.
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          line_string: true,
          point: true,
          trash: true,
        },
        defaultMode: 'simple_select',
      })
      try {
        map.addControl(draw as never)
      } catch (e) {
        console.warn('addControl draw failed', e)
        return
      }
      drawRef.current = draw

      // 3. Listeners — capture creations / deletions into the snapshot.
      const onCreate = (e: { features?: GeoJSON.Feature[] }) => {
        const feats = e.features ?? []
        if (feats.length === 0) return
        for (const f of feats) {
          drawnFeaturesRef.current.features.push(f)
        }
        refreshSource()
        pushToast('Feature added', 'success')
        // Drop out of draw mode back to selection.
        setDrawMode('simple_select')
      }
      const onDelete = (e: { features?: GeoJSON.Feature[] }) => {
        const feats = e.features ?? []
        if (feats.length === 0) return
        const ids = new Set(
          feats
            .map((f) => f.id)
            .filter((x): x is string | number => x != null),
        )
        drawnFeaturesRef.current.features =
          drawnFeaturesRef.current.features.filter(
            (f) => f.id == null || !ids.has(f.id),
          )
        refreshSource()
        pushToast('Feature deleted', 'info')
      }
      listeners.create = onCreate
      listeners.delete = onDelete
      map.on('draw.create' as never, onCreate as never)
      map.on('draw.delete' as never, onDelete as never)

      // 4. Apply whatever mode the store currently requests.
      applyDrawMode(draw, useMapLabStore.getState().drawMode, map)
    }

    // Initial setup — wait for the style to be ready if needed.
    if (map.isStyleLoaded()) {
      initDraw()
    } else {
      map.once('style.load', initDraw)
    }

    // On every subsequent style.load (basemap switch), rebuild draw + the
    // __drawn source/layers from scratch. The drawnFeaturesRef persists
    // across the rebuild so drawings are not lost.
    const onStyleLoad = () => {
      disposeDraw()
      initDraw()
    }
    map.on('style.load', onStyleLoad)

    return () => {
      disposed = true
      map.off('style.load', onStyleLoad)
      disposeDraw()
    }
  }, [map])

  // ---- reflect drawMode changes from the store --------------------------
  React.useEffect(() => {
    if (!drawRef.current) return
    applyDrawMode(drawRef.current, drawMode, map ?? undefined)
  }, [drawMode, map])

  // ---- keep __drawn layers on top after user-style re-applies ----------
  React.useEffect(() => {
    if (!map) return
    // Re-apply happens synchronously inside map-view's effect, which runs
    // before this one for the same store update. Push __drawn back on top.
    for (const id of [LAYER_FILL, LAYER_LINE, LAYER_CIRCLE]) {
      if (map.getLayer(id)) {
        try {
          map.moveLayer(id)
        } catch {
          // ignore
        }
      }
    }
  }, [map, mapStyle])

  // ---- clear drawings button -------------------------------------------
  const handleClear = React.useCallback(() => {
    if (!drawRef.current) return
    try {
      drawRef.current.deleteAll()
    } catch {
      // ignore
    }
    drawnFeaturesRef.current = {
      type: 'FeatureCollection',
      features: [],
    }
    refreshSource()
    setDrawMode(null)
    pushToast('Drawings cleared', 'info')
  }, [refreshSource, setDrawMode, pushToast])

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClear}
        className="pointer-events-auto h-9 gap-1.5 bg-background/80 shadow-sm backdrop-blur-sm"
        title="Clear all drawings"
      >
        <Trash2 className="h-4 w-4" />
        Clear drawings
      </Button>
    </div>
  )
}
