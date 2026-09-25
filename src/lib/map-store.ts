// MapLab Studio — central application store (Zustand).
// This is the single source of truth shared by every panel and the map.
// Persistence: project meta, basemapId, activePanel, and selectedLayerId are
// mirrored to localStorage so the user's session survives reloads.

'use client'

import * as React from 'react'
import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import {
  createDefaultStyle,
  defaultPaintForType,
} from '@/lib/defaults'
import { toMapboxStyle } from '@/lib/map-style'
import type {
  DrawMode,
  LayerSpec,
  LayerType,
  MapStyle,
  MapView,
  PanelId,
  SourceSpec,
  SourceType,
} from '@/lib/types'

const PERSIST_KEY = 'maplab:session:v1'
// Separate key for the full mapStyle (sources + layers). Kept apart so the
// smaller session blob (project meta + UI prefs) doesn't compete with the
// potentially-much-larger style JSON for localStorage quota.
const PERSIST_STYLE_KEY = 'maplab:style:v1'
// Hard cap on the localStorage size we'll attempt to write for the style.
// 2 MB is enough for typical styles (the default + a few PMTiles sources is
// ~5 KB); going past this likely means the user pasted a huge inline GeoJSON
// — we skip persistence in that case rather than throwing QuotaExceededError.
const PERSIST_STYLE_MAX_BYTES = 2 * 1024 * 1024
// Max number of mapStyle snapshots kept in the undo/redo stack. 50 is enough
// for typical editing sessions without blowing memory.
const MAX_HISTORY = 50

interface PersistedSession {
  project: { id: string; name: string; description: string }
  basemapId: string
  activePanel: PanelId
  selectedLayerId: string | null
  rightPanelOpen: boolean
}

function loadPersisted(): Partial<PersistedSession> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<PersistedSession>
  } catch {
    return null
  }
}

function savePersisted(s: PersistedSession) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(s))
  } catch {
    // ignore quota / serialization errors
  }
}

// Load the persisted mapStyle (sources + layers + view). Returns null if
// anything is missing or invalid — the caller falls back to the default
// style in that case.
function loadPersistedStyle(): MapStyle | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PERSIST_STYLE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MapStyle
    // Minimal validation — must have the core shape.
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(parsed.sources) ||
      !Array.isArray(parsed.layers) ||
      !parsed.view
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function savePersistedStyle(s: MapStyle) {
  if (typeof window === 'undefined') return
  try {
    const json = JSON.stringify(s)
    if (json.length > PERSIST_STYLE_MAX_BYTES) {
      // Skip persistence for oversized styles (e.g. huge inline GeoJSON).
      // Remove any previously-stored version so we don't load a stale one.
      window.localStorage.removeItem(PERSIST_STYLE_KEY)
      return
    }
    window.localStorage.setItem(PERSIST_STYLE_KEY, json)
  } catch {
    // ignore quota / serialization errors
  }
}

export interface ProjectMeta {
  id: string
  name: string
  description: string
}

interface MapLabState {
  // ---- project / metadata ----
  project: ProjectMeta
  dirty: boolean

  // ---- the active style ----
  mapStyle: MapStyle

  // ---- map state ----
  basemapId: string
  view: MapView
  // The default view (used by resetView). Set to the initial style's view on
  // store creation and updated whenever loadStyle/newStyle is called.
  defaultView: MapView
  drawMode: DrawMode
  flyToTrigger: { center: [number, number]; zoom?: number } | null
  // Reset-view trigger: when this changes, the MapView resets the camera to
  // `defaultView`.
  resetViewTrigger: number
  // Fit-to-data trigger: a monotonically-increasing counter that the MapView
  // observes. When it changes, the map fits the bounds of all user sources.
  fitToDataTrigger: number

  // ---- UI state ----
  activePanel: PanelId
  selectedLayerId: string | null
  sidebarCollapsed: boolean
  rightPanelOpen: boolean
  publishOpen: boolean
  importOpen: boolean
  shareOpen: boolean
  // Mobile-only overlay flags
  mobilePanelOpen: boolean
  mobileEditorOpen: boolean
  // The feature the user clicked on the map (most recently). The Inspector
  // panel renders its properties when this is non-null. Geometry is kept as
  // an opaque object — the Inspector only needs the properties + layer id.
  selectedFeature: {
    layerId: string
    featureId?: string | number
    properties: Record<string, unknown>
    geometryType: string
    sourceLayer?: string
  } | null
  toasts: { id: string; title: string; kind: 'success' | 'error' | 'info' }[]

  // Ref to the Layer name input in the right-panel editor. Set by the
  // LayerEditor on mount so the F2 keyboard shortcut can focus it without
  // using document.querySelector.
  layerNameInputRef: React.RefObject<HTMLInputElement | null> | null

  // ---- mutators ----
  setProject: (p: Partial<ProjectMeta>) => void
  setBasemap: (id: string) => void
  setActivePanel: (p: PanelId) => void
  selectLayer: (id: string | null) => void
  setDrawMode: (m: DrawMode) => void
  toggleSidebar: () => void
  setRightPanel: (open: boolean) => void
  setPublishOpen: (open: boolean) => void
  setImportOpen: (open: boolean) => void
  setShareOpen: (open: boolean) => void
  setMobilePanelOpen: (open: boolean) => void
  setMobileEditorOpen: (open: boolean) => void
  setSelectedFeature: (
    f: {
      layerId: string
      featureId?: string | number
      properties: Record<string, unknown>
      geometryType: string
      sourceLayer?: string
    } | null,
  ) => void
  setLayerNameInputRef: (
    ref: React.RefObject<HTMLInputElement | null> | null,
  ) => void
  focusLayerNameInput: () => void
  setView: (v: Partial<MapView>) => void
  flyTo: (center: [number, number], zoom?: number) => void
  clearFlyTo: () => void
  fitToData: () => void
  resetView: () => void

  // ---- layer ops ----
  addLayer: (partial?: Partial<LayerSpec>) => string
  updateLayer: (id: string, patch: Partial<LayerSpec>) => void
  removeLayer: (id: string) => void
  reorderLayers: (orderedIds: string[]) => void
  duplicateLayer: (id: string) => void
  setLayerPaint: (id: string, key: string, value: unknown) => void
  setLayerLayout: (id: string, key: string, value: unknown) => void
  setLayerVisible: (id: string, visible: boolean) => void
  setLayerZoom: (id: string, minzoom?: number, maxzoom?: number) => void
  setLayerFilter: (id: string, filter: unknown[] | null) => void
  setLayerName: (id: string, name: string) => void

  // ---- source ops ----
  addSource: (partial?: Partial<SourceSpec>) => string
  updateSource: (id: string, patch: Partial<SourceSpec>) => void
  removeSource: (id: string) => void

  // ---- style ops ----
  loadStyle: (s: MapStyle) => void
  newStyle: () => void
  exportMapboxStyle: () => ReturnType<typeof toMapboxStyle>

  // ---- project ops ----
  // Switch to a different project: update metadata, then fetch the latest
  // style for that project from the backend and load it. If the fetch fails
  // or the project has no saved styles, fall back to a fresh default style
  // so the user isn't stuck with the previous project's style.
  loadProject: (project: ProjectMeta) => Promise<void>

  // ---- undo/redo ----
  // The undo/redo stack tracks snapshots of `mapStyle` (sources + layers).
  // Each mutating action pushes the PREVIOUS state onto the undo stack and
  // clears the redo stack. `undo` pops the undo stack and pushes the current
  // state onto the redo stack; `redo` does the opposite. The stack is capped
  // at MAX_HISTORY entries to avoid unbounded memory growth.
  undoStack: MapStyle[]
  redoStack: MapStyle[]
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  // Clear both stacks (called on loadStyle / newStyle / loadProject so the
  // user can't undo back into a previous project's style).
  clearHistory: () => void

  // ---- toast ----
  pushToast: (title: string, kind?: 'success' | 'error' | 'info') => void
  dismissToast: (id: string) => void
}

const defaultStyle = createDefaultStyle()
const persisted = loadPersisted()
// If a full mapStyle was persisted from a prior session, restore it so the
// user's unsaved edits (added layers/sources, paint tweaks) survive reloads.
// Falls back to the default style when localStorage is empty or invalid.
const persistedStyle = loadPersistedStyle()
const initialStyle = persistedStyle ?? defaultStyle

// Helper: push the current mapStyle onto the undo stack and clear the redo
// stack. Called by every mapStyle-mutating action BEFORE the `set` that
// applies the new state. Uses the store's `get` to read the current state
// and `set` to update the stacks + canUndo/canRedo flags.
function pushHistory(
  get: () => MapLabState,
  set: (
    partial:
      | Partial<MapLabState>
      | ((s: MapLabState) => Partial<MapLabState>),
  ) => void,
) {
  const current = get().mapStyle
  set((s) => {
    const undoStack = [...s.undoStack, current]
    // Cap the stack at MAX_HISTORY entries — drop the oldest.
    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift()
    }
    return {
      undoStack,
      redoStack: [], // any new edit clears the redo stack
      canUndo: true,
      canRedo: false,
    }
  })
}

export const useMapLabStore = create<MapLabState>((set, get) => ({
  project: persisted?.project ?? {
    id: 'default',
    name: 'Untitled Project',
    description: '',
  },
  // If we restored a persisted style, treat the store as not-dirty (the edits
  // were already saved to localStorage). If we fell back to the default,
  // keep dirty=true so the user is nudged to save.
  dirty: !persistedStyle,

  mapStyle: initialStyle,

  basemapId: persisted?.basemapId ?? 'osm-liberty',
  view: initialStyle.view,
  defaultView: initialStyle.view,
  drawMode: null,
  flyToTrigger: null,
  resetViewTrigger: 0,
  fitToDataTrigger: 0,

  activePanel: persisted?.activePanel ?? 'layers',
  selectedLayerId:
    persisted?.selectedLayerId ?? initialStyle.layers[0]?.id ?? null,
  sidebarCollapsed: false,
  rightPanelOpen: persisted?.rightPanelOpen ?? true,
  publishOpen: false,
  importOpen: false,
  shareOpen: false,
  mobilePanelOpen: false,
  mobileEditorOpen: false,
  selectedFeature: null,
  layerNameInputRef: null,
  // Undo/redo stacks — start empty. The first mutation pushes the initial
  // style onto the undo stack.
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,
  toasts: [],

  setProject: (p) =>
    set((s) => ({ project: { ...s.project, ...p }, dirty: true })),

  setBasemap: (id) => set({ basemapId: id }),

  setActivePanel: (p) =>
    set((s) => ({
      activePanel: p,
      // Right panel closes for the "search/routing/api" panels on small screens.
      rightPanelOpen: p === 'layers' || p === 'inspector' ? s.rightPanelOpen : false,
    })),

  selectLayer: (id) => set({ selectedLayerId: id }),

  setDrawMode: (m) => set({ drawMode: m }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setRightPanel: (open) => set({ rightPanelOpen: open }),
  setPublishOpen: (open) => set({ publishOpen: open }),
  setImportOpen: (open) => set({ importOpen: open }),
  setShareOpen: (open) => set({ shareOpen: open }),
  setMobilePanelOpen: (open) => set({ mobilePanelOpen: open }),
  setMobileEditorOpen: (open) => set({ mobileEditorOpen: open }),
  setSelectedFeature: (f) => set({ selectedFeature: f }),
  setLayerNameInputRef: (ref) => set({ layerNameInputRef: ref }),
  focusLayerNameInput: () => {
    const ref = get().layerNameInputRef
    if (ref?.current) {
      ref.current.focus()
      ref.current.select()
    }
  },

  setView: (v) =>
    set((s) => ({ view: { ...s.view, ...v }, dirty: true })),
  flyTo: (center, zoom) => set({ flyToTrigger: { center, zoom } }),
  clearFlyTo: () => set({ flyToTrigger: null }),
  fitToData: () =>
    set((s) => ({ fitToDataTrigger: s.fitToDataTrigger + 1 })),
  resetView: () =>
    set((s) => ({
      // Restore the camera to defaultView and bump the reset trigger so
      // the MapView effect picks it up.
      view: s.defaultView,
      resetViewTrigger: s.resetViewTrigger + 1,
    })),

  addLayer: (partial = {}) => {
    const id = partial.id ?? `layer-${uuid().slice(0, 8)}`
    const type = (partial.type ?? 'fill') as LayerType
    const sourceId =
      partial.sourceId ?? get().mapStyle.sources[0]?.id ?? null
    const layer: LayerSpec = {
      id,
      name: partial.name ?? `New ${type} layer`,
      type,
      sourceId,
      sourceLayer: partial.sourceLayer,
      paint: partial.paint ?? defaultPaintForType(type),
      layout: partial.layout ?? {},
      filter: partial.filter ?? null,
      minzoom: partial.minzoom ?? 0,
      maxzoom: partial.maxzoom ?? 24,
      visible: partial.visible ?? true,
      order: partial.order ?? get().mapStyle.layers.length,
    }
    pushHistory(get, set)
    set((s) => ({
      mapStyle: { ...s.mapStyle, layers: [...s.mapStyle.layers, layer] },
      selectedLayerId: id,
      dirty: true,
    }))
    return id
  },

  updateLayer: (id, patch) => {
    pushHistory(get, set)
    set((s) => ({
      mapStyle: {
        ...s.mapStyle,
        layers: s.mapStyle.layers.map((l) =>
          l.id === id ? { ...l, ...patch } : l,
        ),
      },
      dirty: true,
    }))
  },

  removeLayer: (id) => {
    pushHistory(get, set)
    set((s) => ({
      mapStyle: {
        ...s.mapStyle,
        layers: s.mapStyle.layers.filter((l) => l.id !== id),
      },
      selectedLayerId:
        s.selectedLayerId === id ? null : s.selectedLayerId,
      dirty: true,
    }))
  },

  reorderLayers: (orderedIds) => {
    pushHistory(get, set)
    set((s) => {
      const map = new Map(s.mapStyle.layers.map((l) => [l.id, l]))
      const newLayers = orderedIds
        .map((id, i) => {
          const l = map.get(id)
          if (!l) return null
          return { ...l, order: i }
        })
        .filter(Boolean) as LayerSpec[]
      // append any layers not in orderedIds (defensive)
      for (const l of s.mapStyle.layers) {
        if (!orderedIds.includes(l.id)) newLayers.push(l)
      }
      return { mapStyle: { ...s.mapStyle, layers: newLayers }, dirty: true }
    })
  },

  duplicateLayer: (id) => {
    pushHistory(get, set)
    set((s) => {
      const src = s.mapStyle.layers.find((l) => l.id === id)
      if (!src) return s
      const newId = `layer-${uuid().slice(0, 8)}`
      const copy: LayerSpec = {
        ...src,
        id: newId,
        name: `${src.name} copy`,
        order: s.mapStyle.layers.length,
      }
      return {
        mapStyle: { ...s.mapStyle, layers: [...s.mapStyle.layers, copy] },
        selectedLayerId: newId,
        dirty: true,
      }
    })
  },

  setLayerPaint: (id, key, value) => {
    pushHistory(get, set)
    set((s) => ({
      mapStyle: {
        ...s.mapStyle,
        layers: s.mapStyle.layers.map((l) =>
          l.id === id
            ? { ...l, paint: { ...l.paint, [key]: value } }
            : l,
        ),
      },
      dirty: true,
    }))
  },

  setLayerLayout: (id, key, value) => {
    pushHistory(get, set)
    set((s) => ({
      mapStyle: {
        ...s.mapStyle,
        layers: s.mapStyle.layers.map((l) =>
          l.id === id
            ? { ...l, layout: { ...l.layout, [key]: value } }
            : l,
        ),
      },
      dirty: true,
    }))
  },

  setLayerVisible: (id, visible) => {
    pushHistory(get, set)
    set((s) => ({
      mapStyle: {
        ...s.mapStyle,
        layers: s.mapStyle.layers.map((l) =>
          l.id === id ? { ...l, visible } : l,
        ),
      },
      dirty: true,
    }))
  },

  setLayerZoom: (id, minzoom, maxzoom) => {
    pushHistory(get, set)
    set((s) => ({
      mapStyle: {
        ...s.mapStyle,
        layers: s.mapStyle.layers.map((l) =>
          l.id === id ? { ...l, minzoom, maxzoom } : l,
        ),
      },
      dirty: true,
    }))
  },

  setLayerFilter: (id, filter) => {
    pushHistory(get, set)
    set((s) => ({
      mapStyle: {
        ...s.mapStyle,
        layers: s.mapStyle.layers.map((l) =>
          l.id === id ? { ...l, filter } : l,
        ),
      },
      dirty: true,
    }))
  },

  setLayerName: (id, name) => {
    pushHistory(get, set)
    set((s) => ({
      mapStyle: {
        ...s.mapStyle,
        layers: s.mapStyle.layers.map((l) =>
          l.id === id ? { ...l, name } : l,
        ),
      },
      dirty: true,
    }))
  },

  addSource: (partial = {}) => {
    const id = partial.id ?? `source-${uuid().slice(0, 8)}`
    const type = (partial.type ?? 'geojson') as SourceType
    const src: SourceSpec = {
      id,
      name: partial.name ?? `New ${type} source`,
      type,
      url: partial.url,
      tiles: partial.tiles,
      tileSize: partial.tileSize,
      attribution: partial.attribution,
      maxzoom: partial.maxzoom,
      minzoom: partial.minzoom,
      data: partial.data,
    }
    pushHistory(get, set)
    set((s) => ({
      mapStyle: { ...s.mapStyle, sources: [...s.mapStyle.sources, src] },
      dirty: true,
    }))
    return id
  },

  updateSource: (id, patch) => {
    pushHistory(get, set)
    set((s) => ({
      mapStyle: {
        ...s.mapStyle,
        sources: s.mapStyle.sources.map((src) =>
          src.id === id ? { ...src, ...patch } : src,
        ),
      },
      dirty: true,
    }))
  },

  removeSource: (id) => {
    pushHistory(get, set)
    set((s) => ({
      mapStyle: {
        ...s.mapStyle,
        sources: s.mapStyle.sources.filter((src) => src.id !== id),
        layers: s.mapStyle.layers.map((l) =>
          l.sourceId === id ? { ...l, sourceId: null } : l,
        ),
      },
      dirty: true,
    }))
  },

  loadStyle: (style) =>
    set({
      mapStyle: style,
      view: style.view,
      defaultView: style.view,
      selectedLayerId: style.layers[0]?.id ?? null,
      dirty: true,
      // Loading a new style invalidates the undo/redo stacks — the user
      // can't undo back into a different style.
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    }),

  newStyle: () => {
    const fresh = createDefaultStyle()
    set({
      mapStyle: fresh,
      view: fresh.view,
      defaultView: fresh.view,
      selectedLayerId: fresh.layers[0]?.id ?? null,
      dirty: true,
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    })
  },

  exportMapboxStyle: () => toMapboxStyle(get().mapStyle),

  // Undo: pop the most recent snapshot from the undo stack, push the current
  // mapStyle onto the redo stack, and apply the popped snapshot.
  undo: () => {
    const s = get()
    if (s.undoStack.length === 0) return
    const prev = s.undoStack[s.undoStack.length - 1]!
    const undoStack = s.undoStack.slice(0, -1)
    const redoStack = [...s.redoStack, s.mapStyle]
    if (redoStack.length > MAX_HISTORY) redoStack.shift()
    set({
      mapStyle: prev,
      view: prev.view,
      defaultView: prev.view,
      selectedLayerId:
        prev.layers.find((l) => l.id === s.selectedLayerId)?.id ??
        prev.layers[0]?.id ??
        null,
      dirty: true,
      undoStack,
      redoStack,
      canUndo: undoStack.length > 0,
      canRedo: true,
    })
    get().pushToast('Undo', 'info')
  },

  // Redo: pop the most recent snapshot from the redo stack, push the current
  // mapStyle onto the undo stack, and apply the popped snapshot.
  redo: () => {
    const s = get()
    if (s.redoStack.length === 0) return
    const next = s.redoStack[s.redoStack.length - 1]!
    const redoStack = s.redoStack.slice(0, -1)
    const undoStack = [...s.undoStack, s.mapStyle]
    if (undoStack.length > MAX_HISTORY) undoStack.shift()
    set({
      mapStyle: next,
      view: next.view,
      defaultView: next.view,
      selectedLayerId:
        next.layers.find((l) => l.id === s.selectedLayerId)?.id ??
        next.layers[0]?.id ??
        null,
      dirty: true,
      undoStack,
      redoStack,
      canUndo: true,
      canRedo: redoStack.length > 0,
    })
    get().pushToast('Redo', 'info')
  },

  clearHistory: () =>
    set({
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    }),

  loadProject: async (project: ProjectMeta) => {
    // 1. Update the project metadata immediately so the UI feels responsive.
    set({ project, dirty: false })
    // 2. Fetch the project's latest style from the backend.
    try {
      const listRes = await fetch(`/api/projects/${project.id}/styles`)
      if (!listRes.ok) {
        throw new Error(`GET styles failed: ${listRes.status}`)
      }
      const listData = (await listRes.json()) as {
        styles?: Array<{ id: string }>
      }
      const styles = listData.styles ?? []
      if (styles.length === 0) {
        // Project has no saved styles — load a fresh default so the user
        // starts with the sample layers/sources.
        const fresh = createDefaultStyle()
        set({
          mapStyle: fresh,
          view: fresh.view,
          defaultView: fresh.view,
          selectedLayerId: fresh.layers[0]?.id ?? null,
          dirty: true,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
        })
        get().pushToast(
          `Loaded "${project.name}" (no saved styles)`,
          'info',
        )
        return
      }
      // Fetch the spec of the most-recently-saved style (the API returns
      // them ordered by updatedAt DESC, so the first item is the latest).
      const styleId = styles[0]!.id
      const styleRes = await fetch(`/api/styles/${styleId}`)
      if (!styleRes.ok) {
        throw new Error(`GET style failed: ${styleRes.status}`)
      }
      const styleData = (await styleRes.json()) as {
        style?: {
          name: string
          spec?: MapStyle
        }
      }
      const spec = styleData.style?.spec
      if (!spec) {
        throw new Error('Server returned no style spec')
      }
      // Load the spec into the store — this replaces the entire mapStyle
      // and view, and selects the first layer. Clear history so the user
      // can't undo back into the previous project's style.
      set({
        mapStyle: spec,
        view: spec.view,
        defaultView: spec.view,
        selectedLayerId: spec.layers[0]?.id ?? null,
        dirty: false,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
      })
      get().pushToast(`Loaded "${project.name}"`, 'success')
    } catch (e) {
      get().pushToast(
        `Load failed: ${e instanceof Error ? e.message : String(e)}`,
        'error',
      )
    }
  },

  pushToast: (title, kind = 'success') => {
    const id = uuid().slice(0, 8)
    set((s) => ({ toasts: [...s.toasts, { id, title, kind }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3500)
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }),
  ),
}))

// Subscribe to the persisted fields and mirror them to localStorage. We
// debounce by microtask so a burst of changes (e.g., a drag) only writes
// once.
let _persistScheduled = false
let _persistStyleScheduled = false
useMapLabStore.subscribe((state, prev) => {
  // ---- session blob (project meta + UI prefs) ----
  if (
    state.project === prev.project &&
    state.basemapId === prev.basemapId &&
    state.activePanel === prev.activePanel &&
    state.selectedLayerId === prev.selectedLayerId &&
    state.rightPanelOpen === prev.rightPanelOpen
  ) {
    // fallthrough to style check below
  } else if (!_persistScheduled) {
    _persistScheduled = true
    queueMicrotask(() => {
      _persistScheduled = false
      const s = useMapLabStore.getState()
      savePersisted({
        project: s.project,
        basemapId: s.basemapId,
        activePanel: s.activePanel,
        selectedLayerId: s.selectedLayerId,
        rightPanelOpen: s.rightPanelOpen,
      })
    })
  }

  // ---- full mapStyle (sources + layers + view) ----
  // Persisted separately so unsaved edits survive reloads even when the
  // user hasn't clicked "Save" yet. Skipped for oversized styles.
  if (state.mapStyle === prev.mapStyle) return
  if (_persistStyleScheduled) return
  _persistStyleScheduled = true
  queueMicrotask(() => {
    _persistStyleScheduled = false
    const s = useMapLabStore.getState()
    savePersistedStyle(s.mapStyle)
  })
})
