'use client'

// MapLab Studio — Layers panel.
// Lists every layer in the active style. Supports:
//  - add layer (dropdown of 9 types)
//  - drag-to-reorder (via @dnd-kit/sortable)
//  - click-to-select, rename (pencil toggles inline Input)
//  - visibility toggle, more menu (Duplicate / Move up / Move down / Delete)
//  - client-side name filter

import * as React from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Eye,
  EyeOff,
  Pencil,
  MoreHorizontal,
  Copy,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Search,
  ArrowUpNarrowWide,
  Square,
} from 'lucide-react'

import { useMapLabStore } from '@/lib/map-store'
import { defaultPaintForType } from '@/lib/defaults'
import type { LayerSpec, LayerType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { SourceSpec } from '@/lib/types'

const LAYER_TYPES: { type: LayerType; label: string }[] = [
  { type: 'fill', label: 'Fill' },
  { type: 'line', label: 'Line' },
  { type: 'symbol', label: 'Symbol' },
  { type: 'circle', label: 'Circle' },
  { type: 'raster', label: 'Raster' },
  { type: 'fill-extrusion', label: 'Fill Extrusion' },
  { type: 'background', label: 'Background' },
  { type: 'heatmap', label: 'Heatmap' },
  { type: 'hillshade', label: 'Hillshade' },
]

// Read the "main" paint color of a layer for its row swatch.
function layerSwatchColor(layer: LayerSpec): string | null {
  const t = layer.type
  const p = layer.paint ?? {}
  const pick = (k: string) =>
    typeof p[k] === 'string' ? (p[k] as string) : null
  switch (t) {
    case 'fill':
      return pick('fill-color') ?? pick('fill-outline-color')
    case 'line':
      return pick('line-color')
    case 'circle':
      return pick('circle-color') ?? pick('circle-stroke-color')
    case 'fill-extrusion':
      return pick('fill-extrusion-color')
    case 'background':
      return pick('background-color')
    case 'symbol':
      return pick('text-color')
    case 'heatmap':
      // heatmap-color is an expression array, not a hex
      return null
    case 'hillshade':
      return pick('hillshade-shadow-color')
    case 'raster':
    default:
      return null
  }
}

// Count the features in a layer's source (only for geojson sources with
// inline FeatureCollection data). Vector/PMTiles/raster sources return null.
function layerFeatureCount(
  layer: LayerSpec,
  sources: SourceSpec[],
): number | null {
  if (!layer.sourceId) return null
  const src = sources.find((s) => s.id === layer.sourceId)
  if (!src || src.type !== 'geojson') return null
  const data = src.data
  if (!data || typeof data === 'string') return null
  const fc = data as GeoJSON.FeatureCollection
  // For a layer with a filter, count features that match. We only handle the
  // simple case `['==', ['get', field], value]` — for anything more complex,
  // return the unfiltered count.
  const f = layer.filter
  if (!Array.isArray(f) || f.length === 0) return fc.features?.length ?? 0
  // Best-effort: if it's a simple equals filter, count matching features.
  if (f[0] === '==' && Array.isArray(f[1]) && f[1][0] === 'get') {
    const field = (f[1] as unknown[])[1]
    const value = f[2]
    if (typeof field === 'string') {
      return (
        fc.features?.filter(
          (feat) => feat.properties?.[field] === value,
        ).length ?? 0
      )
    }
  }
  return fc.features?.length ?? 0
}

interface RowProps {
  layer: LayerSpec
  sources: SourceSpec[]
  selected: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onToggleVisibility: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

function SortableLayerRow({
  layer,
  sources,
  selected,
  onSelect,
  onRename,
  onToggleVisibility,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: layer.id })

  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(layer.name)

  React.useEffect(() => {
    if (!editing) setDraft(layer.name)
  }, [layer.name, editing])

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  }

  const swatch = layerSwatchColor(layer)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors',
        selected ? 'bg-accent' : 'hover:bg-accent/50',
        isDragging && 'shadow-md ring-1 ring-border',
      )}
    >
      {/* drag handle */}
      <button
        type="button"
        aria-label="Drag to reorder layer"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      {/* color swatch — tooltip shows the hex (or "expression" for arrays) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="size-6 rounded-md ring-1 ring-border shrink-0 grid place-items-center cursor-help"
            style={{ background: swatch ?? '#9ca3af' }}
          >
            {layer.type === 'symbol' && (
              <Square className="size-3 text-foreground/80" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {swatch ? (
            <span className="font-mono">{swatch}</span>
          ) : (
            <span className="italic">color is an expression</span>
          )}
        </TooltipContent>
      </Tooltip>

      {/* name (inline editable) */}
      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            onRename(draft.trim() || layer.name)
            setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onRename(draft.trim() || layer.name)
              setEditing(false)
            }
            if (e.key === 'Escape') {
              setDraft(layer.name)
              setEditing(false)
            }
          }}
          className="h-7 text-sm flex-1 min-w-0"
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={() => setEditing(true)}
          className="flex-1 min-w-0 text-left text-sm truncate font-medium"
          title={layer.name}
        >
          <span className="truncate">{layer.name}</span>
        </button>
      )}

      {/* type badge + feature count */}
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 hidden sm:inline-flex"
      >
        {layer.type}
      </Badge>
      {(() => {
        const count = layerFeatureCount(layer, sources)
        if (count == null) return null
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="text-[10px] px-1 py-0 hidden md:inline-flex font-mono"
              >
                {count} feat
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {count} feature{count === 1 ? '' : 's'} in source
              {layer.filter ? ' (after filter)' : ''}
            </TooltipContent>
          </Tooltip>
        )
      })()}

      {/* rename (only when not editing) */}
      {!editing && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="Rename layer"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Rename</TooltipContent>
        </Tooltip>
      )}

      {/* visibility */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
            onClick={onToggleVisibility}
          >
            {layer.visible ? (
              <Eye className="size-3.5" />
            ) : (
              <EyeOff className="size-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{layer.visible ? 'Hide' : 'Show'}</TooltipContent>
      </Tooltip>

      {/* more menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label="Layer actions"
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>{layer.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="size-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveUp}>
              <ArrowUp className="size-4" />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveDown}>
              <ArrowDown className="size-4" />
              Move down
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function LayersPanel() {
  const layers = useMapLabStore((s) => s.mapStyle.layers)
  const sources = useMapLabStore((s) => s.mapStyle.sources)
  const selectedLayerId = useMapLabStore((s) => s.selectedLayerId)
  const selectLayer = useMapLabStore((s) => s.selectLayer)
  const addLayer = useMapLabStore((s) => s.addLayer)
  const setLayerName = useMapLabStore((s) => s.setLayerName)
  const setLayerVisible = useMapLabStore((s) => s.setLayerVisible)
  const duplicateLayer = useMapLabStore((s) => s.duplicateLayer)
  const removeLayer = useMapLabStore((s) => s.removeLayer)
  const reorderLayers = useMapLabStore((s) => s.reorderLayers)
  const pushToast = useMapLabStore((s) => s.pushToast)

  const [filter, setFilter] = React.useState('')
  const filterRef = React.useRef<HTMLInputElement | null>(null)
  const [fromSourceOpen, setFromSourceOpen] = React.useState(false)

  // The visible list (sorted by `order` then by list order, filtered by name).
  const visibleLayers = React.useMemo(() => {
    const f = filter.trim().toLowerCase()
    const sorted = [...layers].sort((a, b) => a.order - b.order)
    if (!f) return sorted
    return sorted.filter((l) => l.name.toLowerCase().includes(f) || l.type.includes(f))
  }, [layers, filter])

  const orderedIds = React.useMemo(
    () => [...layers].sort((a, b) => a.order - b.order).map((l) => l.id),
    [layers],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleDragEnd = React.useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e
      if (!over || active.id === over.id) return
      const oldIdx = orderedIds.indexOf(String(active.id))
      const newIdx = orderedIds.indexOf(String(over.id))
      if (oldIdx < 0 || newIdx < 0) return
      const next = arrayMove(orderedIds, oldIdx, newIdx)
      reorderLayers(next)
    },
    [orderedIds, reorderLayers],
  )

  const handleAdd = React.useCallback(
    (type: LayerType) => {
      const id = addLayer({ type, paint: defaultPaintForType(type) })
      selectLayer(id)
      pushToast(`Added ${type} layer`, 'success')
    },
    [addLayer, selectLayer, pushToast],
  )

  const moveLayer = React.useCallback(
    (id: string, dir: -1 | 1) => {
      const idx = orderedIds.indexOf(id)
      if (idx < 0) return
      const next = idx + dir
      if (next < 0 || next >= orderedIds.length) return
      const reordered = arrayMove(orderedIds, idx, next)
      reorderLayers(reordered)
    },
    [orderedIds, reorderLayers],
  )

  // L keyboard shortcut — focus the filter input. Ignore when an input is
  // already focused (so the user can type 'L' inside a textbox).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      const tag = t?.tagName ?? ''
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        t?.isContentEditable === true
      if (isEditable) return
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        filterRef.current?.focus()
        filterRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Build a fill+line pair from a vector/PMTiles source-layer.
  const handleAddFromSource = React.useCallback(
    (sourceId: string, sourceLayer: string) => {
      const fillId = addLayer({
        type: 'fill',
        sourceId,
        sourceLayer,
        name: `${sourceLayer} (fill)`,
        paint: defaultPaintForType('fill'),
      })
      addLayer({
        type: 'line',
        sourceId,
        sourceLayer,
        name: `${sourceLayer} (outline)`,
        paint: defaultPaintForType('line'),
      })
      selectLayer(fillId)
      pushToast(`Added fill + line for "${sourceLayer}"`, 'success')
      setFromSourceOpen(false)
    },
    [addLayer, selectLayer, pushToast],
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Layers</h2>
          <Badge variant="secondary" className="text-[10px] h-5">
            {layers.length}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-[10px] h-5 hidden sm:inline-flex cursor-help font-mono"
              >
                L
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Press L to focus the filter
            </TooltipContent>
          </Tooltip>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-7">
              <Plus className="size-3.5" />
              Add
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Layer type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {LAYER_TYPES.map(({ type, label }) => (
              <DropdownMenuItem key={type} onClick={() => handleAdd(type)}>
                <span className="size-2 rounded-full bg-primary/70" />
                {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setFromSourceOpen(true)}
              disabled={sources.length === 0}
            >
              <Plus className="size-4" />
              From PMTiles source…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            ref={filterRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter layers by name…  (press L)"
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      {/* "Add from PMTiles source" picker — opens when the user picks the
          corresponding menu item. Lists every vector/PMTiles source and
          lets the user type a source-layer name. */}
      <FromSourceDialog
        open={fromSourceOpen}
        onOpenChange={setFromSourceOpen}
        sources={sources}
        onAdd={handleAddFromSource}
      />

      {/* List */}
      <ScrollArea className="flex-1 min-h-0 max-h-[60vh]">
        <div className="px-2 py-2">
          {visibleLayers.length === 0 ? (
            <div className="px-3 py-8 flex flex-col items-center text-center gap-2">
              <ArrowUpNarrowWide className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {layers.length === 0
                  ? 'No layers yet. Add one above.'
                  : 'No layers match your filter.'}
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              // Stable id avoids the dnd-kit `DndDescribedBy-N` SSR mismatch
              // (the auto-id uses an incrementing counter that differs
              // between server and client renders).
              id="maplab-layers-dnd"
            >
              <SortableContext
                items={visibleLayers.map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-0.5">
                  {visibleLayers.map((layer) => (
                    <SortableLayerRow
                      key={layer.id}
                      layer={layer}
                      sources={sources}
                      selected={selectedLayerId === layer.id}
                      onSelect={() => selectLayer(layer.id)}
                      onRename={(name) => setLayerName(layer.id, name)}
                      onToggleVisibility={() =>
                        setLayerVisible(layer.id, !layer.visible)
                      }
                      onDuplicate={() => {
                        duplicateLayer(layer.id)
                        pushToast('Layer duplicated', 'success')
                      }}
                      onMoveUp={() => moveLayer(layer.id, -1)}
                      onMoveDown={() => moveLayer(layer.id, 1)}
                      onDelete={() => {
                        removeLayer(layer.id)
                        pushToast('Layer deleted', 'info')
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export default LayersPanel

// ---------------------------------------------------------------------------
// "Add layer from PMTiles source" dialog.
// Lists every vector/PMTiles source in the active style and lets the user
// type the source-layer name. On confirm, creates a fill + line pair bound
// to that source-layer so the user immediately sees geometry on the map.
// ---------------------------------------------------------------------------

const SOURCE_LAYER_SUGGESTIONS = [
  'landcover',
  'water',
  'waterway',
  'road',
  'building',
  'place',
  'boundary',
]

function FromSourceDialog({
  open,
  onOpenChange,
  sources,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sources: SourceSpec[]
  onAdd: (sourceId: string, sourceLayer: string) => void
}) {
  // Only vector / raster sources are eligible (geojson sources don't have
  // a source-layer concept).
  const eligible = sources.filter(
    (s) => s.type === 'vector' || s.type === 'raster',
  )
  const [sourceId, setSourceId] = React.useState<string>('')
  const [sourceLayer, setSourceLayer] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setSourceId(eligible[0]?.id ?? '')
      setSourceLayer(SOURCE_LAYER_SUGGESTIONS[0] ?? '')
    }
  }, [open, eligible])

  const selectedSource = eligible.find((s) => s.id === sourceId)
  const canSubmit = !!sourceId && !!sourceLayer.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add layer from PMTiles source</DialogTitle>
          <DialogDescription>
            Pick a vector source and type the source-layer name. MapLab will
            create a fill + line pair so you can immediately see the geometry.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Source</Label>
            {eligible.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No vector sources in this style. Add one in the Tiles panel
                first.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {eligible.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSourceId(s.id)}
                    className={cn(
                      'text-left rounded-md border px-2 py-1.5 text-xs transition-colors',
                      sourceId === s.id
                        ? 'border-primary bg-accent'
                        : 'hover:bg-accent/50',
                    )}
                  >
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {s.type} · {s.url ?? 'no url'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-layer" className="text-xs text-muted-foreground">
              Source layer
            </Label>
            <Input
              id="source-layer"
              value={sourceLayer}
              onChange={(e) => setSourceLayer(e.target.value)}
              placeholder="e.g. landcover"
              className="h-9 font-mono text-xs"
              list="maplab-source-layer-suggestions"
            />
            <datalist id="maplab-source-layer-suggestions">
              {SOURCE_LAYER_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          {selectedSource && (
            <div className="rounded-md border bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
              Will add: <span className="font-mono">{sourceLayer || '…'}</span>
              {' → '}
              fill + line on <span className="font-mono">{selectedSource.name}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => onAdd(sourceId, sourceLayer.trim())}
          >
            <Plus className="size-4" />
            Add layers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
