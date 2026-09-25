'use client'

// MapLab Studio — Layer Editor (right panel).
// The control surface for the currently selected layer. Sections:
//   - Appearance   : paint properties (color / number) + layout selects
//   - Labels       : symbol-only label controls (font, size, halo…)
//   - Visibility   : min/max zoom + visible toggle
//   - Data         : source / source-layer / filter JSON
//   - Advanced     : raw JSON + reset paint

import * as React from 'react'
import {
  Wand2,
  Palette,
  Tag,
  Eye,
  Database,
  Terminal,
  RotateCcw,
  Check,
  Copy,
  ImageIcon,
} from 'lucide-react'

import { useMapLabStore } from '@/lib/map-store'
import { COLOR_PRESETS, FONT_PRESETS, defaultPaintForType } from '@/lib/defaults'
import type { LayerSpec, LayerType } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ----------------------------------------------------------------------------
// Descriptors for the appearance section
// ----------------------------------------------------------------------------

type PropKind = 'color' | 'number' | 'select' | 'multiselect' | 'text'
interface PropDesc {
  key: string
  label: string
  group: 'paint' | 'layout'
  kind: PropKind
  min?: number
  max?: number
  step?: number
  options?: { value: string; label: string }[]
}

const COMMON_LINE_JOINS: PropDesc['options'] = [
  { value: 'butt', label: 'Butt' },
  { value: 'round', label: 'Round' },
  { value: 'square', label: 'Square' },
]
const COMMON_LINE_CAPS: PropDesc['options'] = [
  { value: 'round', label: 'Round' },
  { value: 'butt', label: 'Butt' },
  { value: 'square', label: 'Square' },
]

const APPEARANCE_PROPS: Record<LayerType, PropDesc[]> = {
  fill: [
    { key: 'fill-color', label: 'Fill color', group: 'paint', kind: 'color' },
    { key: 'fill-opacity', label: 'Opacity', group: 'paint', kind: 'number', min: 0, max: 1, step: 0.01 },
    { key: 'fill-outline-color', label: 'Outline color', group: 'paint', kind: 'color' },
  ],
  'fill-extrusion': [
    { key: 'fill-extrusion-color', label: 'Color', group: 'paint', kind: 'color' },
    { key: 'fill-extrusion-height', label: 'Height', group: 'paint', kind: 'number', min: 0, max: 500, step: 1 },
    { key: 'fill-extrusion-opacity', label: 'Opacity', group: 'paint', kind: 'number', min: 0, max: 1, step: 0.01 },
  ],
  line: [
    { key: 'line-color', label: 'Color', group: 'paint', kind: 'color' },
    { key: 'line-width', label: 'Width', group: 'paint', kind: 'number', min: 0, max: 20, step: 0.5 },
    { key: 'line-opacity', label: 'Opacity', group: 'paint', kind: 'number', min: 0, max: 1, step: 0.01 },
    { key: 'line-cap', label: 'Cap', group: 'layout', kind: 'select', options: COMMON_LINE_CAPS },
    { key: 'line-join', label: 'Join', group: 'layout', kind: 'select', options: COMMON_LINE_JOINS },
  ],
  circle: [
    { key: 'circle-radius', label: 'Radius', group: 'paint', kind: 'number', min: 0, max: 50, step: 0.5 },
    { key: 'circle-color', label: 'Color', group: 'paint', kind: 'color' },
    { key: 'circle-stroke-color', label: 'Stroke color', group: 'paint', kind: 'color' },
    { key: 'circle-stroke-width', label: 'Stroke width', group: 'paint', kind: 'number', min: 0, max: 20, step: 0.5 },
    { key: 'circle-opacity', label: 'Opacity', group: 'paint', kind: 'number', min: 0, max: 1, step: 0.01 },
  ],
  symbol: [
    { key: 'text-field', label: 'Text field', group: 'layout', kind: 'text' },
    { key: 'text-size', label: 'Size', group: 'layout', kind: 'number', min: 4, max: 48, step: 1 },
    { key: 'text-color', label: 'Color', group: 'paint', kind: 'color' },
    { key: 'text-font', label: 'Font', group: 'layout', kind: 'multiselect' },
  ],
  background: [
    { key: 'background-color', label: 'Color', group: 'paint', kind: 'color' },
    { key: 'background-opacity', label: 'Opacity', group: 'paint', kind: 'number', min: 0, max: 1, step: 0.01 },
  ],
  raster: [
    { key: 'raster-opacity', label: 'Opacity', group: 'paint', kind: 'number', min: 0, max: 1, step: 0.01 },
  ],
  heatmap: [
    { key: 'heatmap-color', label: 'Color ramp', group: 'paint', kind: 'text' },
    { key: 'heatmap-intensity', label: 'Intensity', group: 'paint', kind: 'number', min: 0, max: 5, step: 0.1 },
    { key: 'heatmap-radius', label: 'Radius', group: 'paint', kind: 'number', min: 0, max: 100, step: 1 },
  ],
  hillshade: [
    { key: 'hillshade-illumination-direction', label: 'Illumination dir', group: 'paint', kind: 'number', min: 0, max: 360, step: 1 },
    { key: 'hillshade-shadow-color', label: 'Shadow color', group: 'paint', kind: 'color' },
  ],
}

// Filter expression examples for the Data section dropdown.
const FILTER_EXAMPLES: { label: string; value: string }[] = [
  { label: 'Equal (kind == road)', value: '["==", ["get","kind"], "road"]' },
  { label: 'In list', value: '["in", ["get","kind"], "road","rail"]' },
  { label: 'Not equal', value: '["!=", ["get","kind"], "water"]' },
  { label: 'Greater than (population > 100000)', value: '[">", ["get","population"], 100000]' },
  { label: 'All of', value: '["all", ["==", ["get","kind"], "road"], [">", ["get","zoom"], 5]]' },
  { label: 'Any of', value: '["any", ["==", ["get","kind"], "rail"], ["==", ["get","kind"], "air"]]'},
]

// ----------------------------------------------------------------------------
// Small reusable field components
// ----------------------------------------------------------------------------

interface ColorFieldProps {
  label: string
  value: unknown
  onChange: (v: string) => void
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  // Only hex colors are editable; expression values are shown read-only.
  const isHex = typeof value === 'string' && /^#([0-9a-fA-F]{3}){1,2}$/.test(value)
  const hex = isHex ? (value as string) : '#888888'

  return (
    <div className="grid grid-cols-3 items-center gap-2 py-1">
      <Label className="text-xs col-span-1 text-muted-foreground">{label}</Label>
      <div className="col-span-2 flex items-center gap-2">
        <label
          className="relative size-7 rounded-md ring-1 ring-border shrink-0 cursor-pointer overflow-hidden"
          style={{ background: hex }}
          title="Pick color"
        >
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            disabled={!isHex}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label={`${label} color picker`}
          />
        </label>
        <Input
          value={isHex ? (value as string) : String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={!isHex}
          className="h-7 text-xs font-mono"
          placeholder={isHex ? '#000000' : 'expression'}
        />
      </div>
      <div className="col-span-3 flex flex-wrap gap-1.5 pt-1">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="size-5 rounded ring-1 ring-border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ background: c }}
            title={c}
            aria-label={`Use color ${c}`}
          />
        ))}
      </div>
    </div>
  )
}

interface NumberFieldProps {
  label: string
  value: unknown
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
}

function NumberField({ label, value, min, max, step, onChange }: NumberFieldProps) {
  const numeric = typeof value === 'number' ? value : Number(value)
  const safe = Number.isFinite(numeric) ? numeric : min ?? 0
  const sliderMin = min ?? 0
  const sliderMax = max ?? 100
  const sliderStep = step ?? 1

  return (
    <div className="grid grid-cols-3 items-center gap-2 py-1">
      <Label className="text-xs col-span-1 text-muted-foreground">{label}</Label>
      <div className="col-span-2 flex items-center gap-2">
        <Slider
          value={[safe]}
          min={sliderMin}
          max={sliderMax}
          step={sliderStep}
          onValueChange={(arr) => onChange(arr[0])}
          className="flex-1"
          aria-label={label}
        />
        <Input
          type="number"
          inputMode="decimal"
          value={safe}
          min={sliderMin}
          max={sliderMax}
          step={sliderStep}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (Number.isFinite(v)) onChange(v)
          }}
          className="h-7 w-16 text-xs"
        />
      </div>
    </div>
  )
}

interface SelectFieldProps {
  label: string
  value: unknown
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  const str = typeof value === 'string' ? value : ''
  return (
    <div className="grid grid-cols-3 items-center gap-2 py-1">
      <Label className="text-xs col-span-1 text-muted-foreground">{label}</Label>
      <Select value={str || undefined} onValueChange={onChange}>
        <SelectTrigger className="col-span-2 h-7 text-xs">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface MultiSelectFieldProps {
  label: string
  value: unknown
  options: string[]
  onChange: (v: string[]) => void
}

function MultiSelectField({ label, value, options, onChange }: MultiSelectFieldProps) {
  const arr = Array.isArray(value) ? (value.filter((v) => typeof v === 'string') as string[]) : []
  const toggle = (v: string) => {
    if (arr.includes(v)) onChange(arr.filter((x) => x !== v))
    else onChange([...arr, v])
  }
  return (
    <div className="py-1">
      <Label className="text-xs text-muted-foreground block mb-1.5">{label}</Label>
      <div className="grid grid-cols-2 gap-1">
        {options.map((opt) => {
          const on = arr.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={cn(
                'flex items-center gap-1.5 h-8 px-2 rounded-md border text-xs text-left transition-colors',
                on
                  ? 'bg-primary text-primary-foreground border-transparent'
                  : 'bg-transparent hover:bg-accent',
              )}
            >
              <span
                className={cn(
                  'size-3.5 rounded-sm grid place-items-center border',
                  on ? 'bg-primary-foreground/20 border-transparent' : 'border-border',
                )}
              >
                {on ? <Check className="size-3" /> : null}
              </span>
              <span className="truncate">{opt}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface TextFieldProps {
  label: string
  value: unknown
  placeholder?: string
  onChange: (v: string) => void
}

function TextField({ label, value, placeholder, onChange }: TextFieldProps) {
  const str = typeof value === 'string' ? value : ''
  return (
    <div className="grid grid-cols-3 items-center gap-2 py-1">
      <Label className="text-xs col-span-1 text-muted-foreground">{label}</Label>
      <Input
        value={str}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="col-span-2 h-7 text-xs font-mono"
      />
    </div>
  )
}

// ----------------------------------------------------------------------------
// Section helpers
// ----------------------------------------------------------------------------

function PropRow({
  desc,
  layer,
  setPaint,
  setLayout,
}: {
  desc: PropDesc
  layer: LayerSpec
  setPaint: (key: string, value: unknown) => void
  setLayout: (key: string, value: unknown) => void
}) {
  const bag = desc.group === 'paint' ? layer.paint : layer.layout
  const value = bag[desc.key]
  const setter = desc.group === 'paint' ? setPaint : setLayout

  switch (desc.kind) {
    case 'color':
      return (
        <ColorField
          label={desc.label}
          value={value}
          onChange={(v) => setter(desc.key, v)}
        />
      )
    case 'number':
      return (
        <NumberField
          label={desc.label}
          value={value}
          min={desc.min}
          max={desc.max}
          step={desc.step}
          onChange={(v) => setter(desc.key, v)}
        />
      )
    case 'select':
      return (
        <SelectField
          label={desc.label}
          value={value}
          options={desc.options ?? []}
          onChange={(v) => setter(desc.key, v)}
        />
      )
    case 'multiselect':
      return (
        <MultiSelectField
          label={desc.label}
          value={value}
          options={FONT_PRESETS}
          onChange={(v) => setter(desc.key, v)}
        />
      )
    case 'text':
      return (
        <TextField
          label={desc.label}
          value={value}
          placeholder={`["get","name"]`}
          onChange={(v) => setter(desc.key, v)}
        />
      )
  }
}

// ----------------------------------------------------------------------------
// Main editor
// ----------------------------------------------------------------------------

export function LayerEditor() {
  const selectedLayerId = useMapLabStore((s) => s.selectedLayerId)
  const layer = useMapLabStore((s) =>
    s.mapStyle.layers.find((l) => l.id === s.selectedLayerId) ?? null,
  )
  const sources = useMapLabStore((s) => s.mapStyle.sources)
  const setLayerPaint = useMapLabStore((s) => s.setLayerPaint)
  const setLayerLayout = useMapLabStore((s) => s.setLayerLayout)
  const setLayerVisible = useMapLabStore((s) => s.setLayerVisible)
  const setLayerZoom = useMapLabStore((s) => s.setLayerZoom)
  const setLayerFilter = useMapLabStore((s) => s.setLayerFilter)
  const setLayerName = useMapLabStore((s) => s.setLayerName)
  const updateLayer = useMapLabStore((s) => s.updateLayer)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const setLayerNameInputRef = useMapLabStore((s) => s.setLayerNameInputRef)

  // Ref to the Layer name input — registered with the store so the F2
  // keyboard shortcut can focus it without DOM coupling.
  const nameInputRef = React.useRef<HTMLInputElement | null>(null)
  React.useEffect(() => {
    setLayerNameInputRef(nameInputRef)
    return () => setLayerNameInputRef(null)
  }, [setLayerNameInputRef])

  // Local UI state that needs to live outside the store to avoid stale inputs.
  const [nameDraft, setNameDraft] = React.useState('')
  const [filterDraft, setFilterDraft] = React.useState('')
  const [filterError, setFilterError] = React.useState<string | null>(null)
  const [copyState, setCopyState] = React.useState<'idle' | 'copied'>('idle')

  React.useEffect(() => {
    if (layer) {
      setNameDraft(layer.name)
      setFilterDraft(layer.filter ? JSON.stringify(layer.filter) : '')
      setFilterError(null)
    }
  }, [layer?.id, layer?.name, layer?.filter])

  if (!layer) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
        <div className="size-10 rounded-full bg-muted grid place-items-center">
          <Wand2 className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold">No layer selected</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
            Pick a layer from the list to edit its style, zoom range, data
            source and filter.
          </p>
        </div>
      </div>
    )
  }

  const setPaint = (key: string, value: unknown) => setLayerPaint(layer.id, key, value)
  const setLayout = (key: string, value: unknown) => {
    // Allow toggling off layout text-field when it's empty
    if (value === '' || value === null) {
      setLayerLayout(layer.id, key, null)
      return
    }
    setLayerLayout(layer.id, key, value)
  }

  const commitFilter = () => {
    const v = filterDraft.trim()
    if (!v) {
      setFilterError(null)
      setLayerFilter(layer.id, null)
      return
    }
    try {
      const parsed = JSON.parse(v)
      if (Array.isArray(parsed)) {
        setLayerFilter(layer.id, parsed)
        setFilterError(null)
      } else {
        setFilterError('Filter must be a JSON array')
      }
    } catch (e) {
      setFilterError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }

  const sourceObj = sources.find((s) => s.id === layer.sourceId) ?? null
  const layerJson = JSON.stringify(layer, null, 2)

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(layerJson)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 1500)
      pushToast('Layer JSON copied', 'success')
    } catch {
      pushToast('Clipboard unavailable', 'error')
    }
  }

  // Show Appearance section? Background is the only one with no source / label concept,
  // but we still show its background-color/background-opacity here.
  const appearanceProps = APPEARANCE_PROPS[layer.type] ?? []
  const isSymbol = layer.type === 'symbol'

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-3 py-3 border-b">
        <div className="flex items-center gap-2">
          {/* Live-preview chip — visualizes the layer's main paint properties
              so the user sees what they're configuring without looking at the
              map. */}
          <LivePreviewChip layer={layer} />
          <Input
            ref={nameInputRef}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => setLayerName(layer.id, nameDraft.trim() || layer.name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.currentTarget.blur()
              }
            }}
            className="h-8 text-base font-semibold border-transparent bg-transparent focus-visible:bg-background focus-visible:border-input px-1 flex-1 min-w-0"
            aria-label="Layer name"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 px-1">
          <Badge variant="secondary" className="text-[10px] h-5">
            {layer.type}
          </Badge>
          {layer.sourceId ? (
            <Badge variant="outline" className="text-[10px] h-5">
              src: {sourceObj?.name ?? layer.sourceId}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">
              no source
            </Badge>
          )}
          {layer.sourceLayer ? (
            <Badge variant="outline" className="text-[10px] h-5">
              layer: {layer.sourceLayer}
            </Badge>
          ) : null}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0 max-h-[calc(100vh-3rem)]">
        <Accordion
          type="multiple"
          defaultValue={['appearance', 'visibility', 'data']}
          className="px-3"
        >
          {/* APPEARANCE */}
          {appearanceProps.length > 0 && (
            <AccordionItem value="appearance">
              <AccordionTrigger className="py-3 text-sm font-semibold tracking-tight">
                <span className="flex items-center gap-2">
                  <Palette className="size-4" />
                  Appearance
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-0.5">
                  {appearanceProps.map((p) => (
                    <PropRow
                      key={p.key}
                      desc={p}
                      layer={layer}
                      setPaint={setPaint}
                      setLayout={setLayout}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* LABELS — only for symbol */}
          {isSymbol && (
            <AccordionItem value="labels">
              <AccordionTrigger className="py-3 text-sm font-semibold tracking-tight">
                <span className="flex items-center gap-2">
                  <Tag className="size-4" />
                  Labels
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 py-1">
                    <Label className="text-xs text-muted-foreground">Show road names</Label>
                    <Switch
                      checked={!!layer.layout['text-field']}
                      onCheckedChange={(on) =>
                        setLayerLayout(
                          layer.id,
                          'text-field',
                          on ? ['get', 'name'] : null,
                        )
                      }
                    />
                  </div>
                  <SelectField
                    label="Font"
                    value={(layer.layout['text-font'] as unknown[])?.[0] ?? ''}
                    options={FONT_PRESETS.map((f) => ({ value: f, label: f }))}
                    onChange={(v) => setLayerLayout(layer.id, 'text-font', [v])}
                  />
                  <NumberField
                    label="Size"
                    value={layer.layout['text-size'] ?? 16}
                    min={4}
                    max={32}
                    step={1}
                    onChange={(v) => setLayerLayout(layer.id, 'text-size', v)}
                  />
                  <ColorField
                    label="Color"
                    value={layer.paint['text-color'] ?? '#1f2937'}
                    onChange={(v) => setLayerPaint(layer.id, 'text-color', v)}
                  />
                  <ColorField
                    label="Halo color"
                    value={layer.paint['text-halo-color'] ?? '#ffffff'}
                    onChange={(v) => setLayerPaint(layer.id, 'text-halo-color', v)}
                  />
                  <NumberField
                    label="Halo width"
                    value={layer.paint['text-halo-width'] ?? 1}
                    min={0}
                    max={10}
                    step={0.5}
                    onChange={(v) => setLayerPaint(layer.id, 'text-halo-width', v)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* VISIBILITY */}
          <AccordionItem value="visibility">
            <AccordionTrigger className="py-3 text-sm font-semibold tracking-tight">
              <span className="flex items-center gap-2">
                <Eye className="size-4" />
                Visibility
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-2">
                <NumberField
                  label="Min zoom"
                  value={layer.minzoom ?? 0}
                  min={0}
                  max={22}
                  step={1}
                  onChange={(v) =>
                    setLayerZoom(
                      layer.id,
                      Math.min(v, layer.maxzoom ?? 24),
                      layer.maxzoom ?? 24,
                    )
                  }
                />
                <NumberField
                  label="Max zoom"
                  value={layer.maxzoom ?? 24}
                  min={0}
                  max={22}
                  step={1}
                  onChange={(v) =>
                    setLayerZoom(
                      layer.id,
                      layer.minzoom ?? 0,
                      Math.max(v, layer.minzoom ?? 0),
                    )
                  }
                />
                <div className="flex items-center justify-between gap-2 py-1 mt-1">
                  <Label className="text-xs text-muted-foreground">Visible</Label>
                  <Switch
                    checked={layer.visible}
                    onCheckedChange={(on) => setLayerVisible(layer.id, on)}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* DATA */}
          <AccordionItem value="data">
            <AccordionTrigger className="py-3 text-sm font-semibold tracking-tight">
              <span className="flex items-center gap-2">
                <Database className="size-4" />
                Data
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-3 items-center gap-2 py-1">
                  <Label className="text-xs col-span-1 text-muted-foreground">Source</Label>
                  <Select
                    value={layer.sourceId ?? undefined}
                    onValueChange={(v) => updateLayer(layer.id, { sourceId: v })}
                  >
                    <SelectTrigger className="col-span-2 h-7 text-xs">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {sources.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <TextField
                  label="Source layer"
                  value={layer.sourceLayer ?? ''}
                  placeholder="e.g. land"
                  onChange={(v) =>
                    updateLayer(layer.id, { sourceLayer: v || undefined })
                  }
                />
                <Separator className="my-2" />
                <div className="flex items-center justify-between gap-2 py-0.5">
                  <Label className="text-xs text-muted-foreground">Filter (JSON)</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                        Examples
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      {FILTER_EXAMPLES.map((ex) => (
                        <DropdownMenuItem
                          key={ex.label}
                          onClick={() => {
                            setFilterDraft(ex.value)
                            // commit on selection: validate & store
                            try {
                              const parsed = JSON.parse(ex.value)
                              if (Array.isArray(parsed)) {
                                setLayerFilter(layer.id, parsed)
                                setFilterError(null)
                              }
                            } catch {
                              /* ignore */
                            }
                          }}
                        >
                          <span className="text-xs text-muted-foreground">
                            {ex.label}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Textarea
                  value={filterDraft}
                  onChange={(e) => setFilterDraft(e.target.value)}
                  onBlur={commitFilter}
                  placeholder='["==", ["get","kind"], "road"]'
                  className={cn(
                    'h-16 text-xs font-mono',
                    filterError && 'border-destructive focus-visible:ring-destructive/20',
                  )}
                />
                {filterError ? (
                  <p className="text-xs text-destructive">{filterError}</p>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ADVANCED */}
          <AccordionItem value="advanced">
            <AccordionTrigger className="py-3 text-sm font-semibold tracking-tight">
              <span className="flex items-center gap-2">
                <Terminal className="size-4" />
                Advanced
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Raw layer JSON</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={copyJson}
                  >
                    {copyState === 'copied' ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    Copy
                  </Button>
                </div>
                <Textarea
                  readOnly
                  value={layerJson}
                  className="h-44 text-[11px] font-mono resize-none bg-muted/40"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="self-start h-8"
                      onClick={() => {
                        updateLayer(layer.id, {
                          paint: defaultPaintForType(layer.type),
                        })
                        pushToast('Paint properties reset', 'info')
                      }}
                    >
                      <RotateCcw className="size-3.5" />
                      Reset paint
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Restore default paint for this layer type
                  </TooltipContent>
                </Tooltip>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        {/* bottom spacing so last accordion item doesn't get clipped */}
        <div className="h-6" />
      </ScrollArea>
    </div>
  )
}

export default LayerEditor

// ---------------------------------------------------------------------------
// LivePreviewChip — visualizes the layer's main paint properties in the
// header so the user gets instant feedback while editing.
//   - fill / fill-extrusion / background → colored square (with opacity)
//   - line → colored thick line (width scaled)
//   - circle → colored dot
//   - symbol → text "Aa" in the chosen font/color
//   - heatmap → gradient strip
//   - hillshade → shaded strip
//   - raster → muted placeholder
// ---------------------------------------------------------------------------

function readColor(paint: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = paint[k]
    if (typeof v === 'string' && /^#|rgb|hsl/.test(v)) return v
  }
  return null
}
function readNumber(paint: Record<string, unknown>, key: string, fallback: number): number {
  const v = paint[key]
  return typeof v === 'number' ? v : fallback
}

function LivePreviewChip({ layer }: { layer: LayerSpec }) {
  const p = layer.paint ?? {}
  const swatch =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1 ring-border bg-muted/30'

  switch (layer.type) {
    case 'fill':
    case 'fill-extrusion': {
      const color =
        readColor(p, 'fill-color', 'fill-extrusion-color') ?? '#3fa34d'
      const opacity = readNumber(p, 'fill-opacity', 0.5)
      return (
        <span
          className={swatch}
          style={{ background: color, opacity: Math.min(1, opacity + 0.15) }}
          title={`${color} · opacity ${opacity}`}
        />
      )
    }
    case 'background': {
      const color = readColor(p, 'background-color') ?? '#e7e5e4'
      const opacity = readNumber(p, 'background-opacity', 1)
      return (
        <span
          className={swatch}
          style={{ background: color, opacity: Math.min(1, opacity) }}
          title={`background ${color}`}
        />
      )
    }
    case 'line': {
      const color = readColor(p, 'line-color') ?? '#2a9d8f'
      const width = readNumber(p, 'line-width', 2)
      const opacity = readNumber(p, 'line-opacity', 1)
      // Scale width 0..10 → 1..6px for visual.
      const px = Math.min(6, Math.max(1, Math.round(width * 0.6)))
      return (
        <span className={swatch} title={`line ${color} · width ${width}`}>
          <span
            className="block rounded-full"
            style={{
              width: 22,
              height: px,
              background: color,
              opacity: Math.min(1, opacity),
            }}
          />
        </span>
      )
    }
    case 'circle': {
      const color = readColor(p, 'circle-color') ?? '#e4192b'
      const stroke = readColor(p, 'circle-stroke-color') ?? '#ffffff'
      const radius = readNumber(p, 'circle-radius', 7)
      const r = Math.min(13, Math.max(4, radius))
      return (
        <span className={swatch} title={`circle ${color} · r ${radius}`}>
          <span
            className="block rounded-full"
            style={{
              width: r * 2,
              height: r * 2,
              background: color,
              boxShadow: `0 0 0 2px ${stroke}`,
            }}
          />
        </span>
      )
    }
    case 'symbol': {
      const color = readColor(p, 'text-color') ?? '#0f172a'
      const haloColor = readColor(p, 'text-halo-color')
      const haloWidth = readNumber(p, 'text-halo-width', 0)
      const size = readNumber(p, 'text-size', 14)
      // text-shadow mimics maplibre's text-halo for the preview chip.
      const halo =
        haloColor && haloWidth > 0
          ? `${haloColor} ${Math.min(3, haloWidth)}px, ${haloColor} ${Math.min(
              3,
              haloWidth,
            )}px, ${haloColor} ${Math.min(3, haloWidth)}px ${Math.min(
              3,
              haloWidth,
            )}px`
          : undefined
      return (
        <span
          className={swatch}
          title={`text ${color} · ${size}px${halo ? ` · halo ${haloColor} ${haloWidth}` : ''}`}
        >
          <span
            style={{
              color,
              fontSize: Math.min(18, size),
              fontWeight: 600,
              textShadow: halo,
              WebkitTextStroke:
                haloColor && haloWidth > 0
                  ? `${Math.min(2, haloWidth * 0.5)}px ${haloColor}`
                  : undefined,
            }}
          >
            Aa
          </span>
        </span>
      )
    }
    case 'heatmap': {
      return (
        <span
          className={swatch}
          style={{
            background:
              'linear-gradient(90deg, rgba(0,0,255,0) 0%, #2a9d8f 50%, #e4192b 100%)',
          }}
          title="heatmap gradient"
        />
      )
    }
    case 'hillshade': {
      return (
        <span
          className={swatch}
          style={{
            background:
              'linear-gradient(135deg, #d4d4d4 0%, #9ca3af 50%, #473b29 100%)',
          }}
          title="hillshade shadow"
        />
      )
    }
    case 'raster':
    default:
      return (
        <span className={swatch} title="raster layer">
          <ImageIcon className="size-3.5 text-muted-foreground" />
        </span>
      )
  }
}
