'use client'

// MapLab Studio — Inspector panel.
// Shows the properties of the feature the user clicked on the map (if any),
// followed by the selected layer's spec (id, source, paint, layout, filter).
// Includes Copy-as-JSON buttons for both.

import * as React from 'react'
import { Copy, Check, Info, FileJson, MapPin, X, Hash } from 'lucide-react'

import { useMapLabStore } from '@/lib/map-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v)
  }
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function KVTable({ rows }: { rows: Array<[string, unknown]> }) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic px-1 py-2">
        No properties.
      </p>
    )
  }
  return (
    <div className="rounded-md border overflow-hidden">
      {rows.map(([k, v], i) => (
        <div
          key={k}
          className={`flex items-start gap-2 text-xs px-2 py-1.5 ${i % 2 === 0 ? 'bg-muted/30' : ''}`}
        >
          <span className="font-mono text-muted-foreground shrink-0 w-28 truncate">
            {k}
          </span>
          <span className="font-mono break-all flex-1 text-foreground">
            {formatValue(v)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function Inspector() {
  const layer = useMapLabStore((s) =>
    s.mapStyle.layers.find((l) => l.id === s.selectedLayerId) ?? null,
  )
  const sources = useMapLabStore((s) => s.mapStyle.sources)
  const selectedFeature = useMapLabStore((s) => s.selectedFeature)
  const setSelectedFeature = useMapLabStore((s) => s.setSelectedFeature)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const [copied, setCopied] = React.useState(false)
  const [copiedFeature, setCopiedFeature] = React.useState(false)

  const sourceObj = layer ? sources.find((s) => s.id === layer.sourceId) : null

  const copyJson = async () => {
    if (!layer) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(layer, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      pushToast('Layer spec copied to clipboard', 'success')
    } catch {
      pushToast('Clipboard unavailable', 'error')
    }
  }

  const copyFeatureJson = async () => {
    if (!selectedFeature) return
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(selectedFeature.properties, null, 2),
      )
      setCopiedFeature(true)
      setTimeout(() => setCopiedFeature(false), 1500)
      pushToast('Feature properties copied', 'success')
    } catch {
      pushToast('Clipboard unavailable', 'error')
    }
  }

  if (!layer && !selectedFeature) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
        <div className="size-10 rounded-full bg-muted grid place-items-center">
          <Info className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold">Nothing to inspect</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
            Click a feature on the map to inspect its properties, or select a
            layer to view its full spec.
          </p>
        </div>
      </div>
    )
  }

  const paintRows = layer
    ? Object.entries(layer.paint).sort(([a], [b]) => a.localeCompare(b))
    : []
  const layoutRows = layer
    ? Object.entries(layer.layout).sort(([a], [b]) => a.localeCompare(b))
    : []
  const featureRows = selectedFeature
    ? Object.entries(selectedFeature.properties)
    : []
  // Find the layer name for the selected feature's layerId.
  const featureLayerName =
    layer && selectedFeature && selectedFeature.layerId === layer.id
      ? layer.name
      : useMapLabStore
          .getState()
          .mapStyle.layers.find((l) => l.id === selectedFeature?.layerId)?.name ??
        selectedFeature?.layerId ??
        '—'

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-3 py-3 border-b">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight truncate">
            Inspector
          </h2>
          {layer && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={copyJson}
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  Copy JSON
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy full layer spec</TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {selectedFeature
            ? 'Inspecting clicked feature + layer spec.'
            : 'Inspecting selected layer spec.'}
        </p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-3 flex flex-col gap-3">
          {/* SELECTED FEATURE */}
          {selectedFeature ? (
            <>
              <section>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-xs font-semibold tracking-tight flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    Clicked feature
                  </h3>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={copyFeatureJson}
                          aria-label="Copy feature properties"
                        >
                          {copiedFeature ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy feature properties</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => setSelectedFeature(null)}
                          aria-label="Clear feature selection"
                        >
                          <X className="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Clear feature selection</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {selectedFeature.geometryType}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-5">
                    on: {featureLayerName}
                  </Badge>
                  {selectedFeature.sourceLayer ? (
                    <Badge variant="outline" className="text-[10px] h-5 font-mono">
                      src-layer: {selectedFeature.sourceLayer}
                    </Badge>
                  ) : null}
                  {selectedFeature.featureId != null ? (
                    <Badge variant="outline" className="text-[10px] h-5 font-mono">
                      <Hash className="size-2.5" />
                      {selectedFeature.featureId}
                    </Badge>
                  ) : null}
                </div>
                <KVTable rows={featureRows} />
              </section>
              <Separator />
            </>
          ) : null}

          {/* LAYER SPEC — only show if a layer is selected. */}
          {layer ? (
            <>
              <section>
                <h3 className="text-xs font-semibold tracking-tight mb-1 flex items-center gap-1.5">
                  <Info className="size-3.5" /> Layer spec
                  <span className="text-muted-foreground font-normal truncate">
                    · {layer.name}
                  </span>
                </h3>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {layer.type}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-5 font-mono">
                    id: {layer.id}
                  </Badge>
                </div>
                <KVTable
                  rows={[
                    ['name', layer.name],
                    ['type', layer.type],
                    ['order', layer.order],
                    ['visible', layer.visible],
                    ['minzoom', layer.minzoom ?? 0],
                    ['maxzoom', layer.maxzoom ?? 24],
                  ]}
                />
              </section>

              <Separator />

              <section>
                <h3 className="text-xs font-semibold tracking-tight mb-1 flex items-center gap-1.5">
                  <FileJson className="size-3.5" /> Source
                </h3>
                <KVTable
                  rows={[
                    ['sourceId', layer.sourceId ?? '—'],
                    ['source type', sourceObj?.type ?? '—'],
                    ['source name', sourceObj?.name ?? '—'],
                    ['source-layer', layer.sourceLayer ?? '—'],
                    ['source url', sourceObj?.url ?? '—'],
                  ]}
                />
              </section>

              <Separator />

              <section>
                <h3 className="text-xs font-semibold tracking-tight mb-1">
                  Paint properties
                </h3>
                <KVTable rows={paintRows} />
              </section>

              <Separator />

              <section>
                <h3 className="text-xs font-semibold tracking-tight mb-1">
                  Layout properties
                </h3>
                <KVTable rows={layoutRows} />
              </section>

              {layer.filter && Array.isArray(layer.filter) ? (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-xs font-semibold tracking-tight mb-1">
                      Filter expression
                    </h3>
                    <pre className="text-[11px] font-mono rounded-md border bg-muted/40 p-2 overflow-auto max-h-40">
                      {JSON.stringify(layer.filter, null, 2)}
                    </pre>
                  </section>
                </>
              ) : null}
            </>
          ) : null}
          <div className="h-6" />
        </div>
      </ScrollArea>
    </div>
  )
}

export default Inspector
