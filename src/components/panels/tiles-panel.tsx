'use client'

// MapLab Studio — "Tiles" panel.
// Lists all tile sources (any type), lets you load PMTiles metadata, and
// provides an Add Tile Source form (pmtiles / vector / raster / raster-dem).

import * as React from 'react'
import {
  Layers3,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Info,
  Globe2,
} from 'lucide-react'
import { useMapLabStore } from '@/lib/map-store'
import { DEMO_PMTILES } from '@/lib/defaults'
import {
  pmtilesSourceUrl,
  fetchPmTilesMeta,
} from '@/lib/pmtiles-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { SourceSpec, SourceType } from '@/lib/types'

function PanelHeader({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <header className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {action}
    </header>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-4 mt-4 mb-2">
      {children}
    </h3>
  )
}

function isPmtilesSource(src: SourceSpec): boolean {
  if (!src.url) return false
  return (
    src.url.startsWith('pmtiles://') || src.url.includes('.pmtiles')
  )
}

function TileSourceRow({ src }: { src: SourceSpec }) {
  const removeSource = useMapLabStore((s) => s.removeSource)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [meta, setMeta] = React.useState<{
    minZoom?: number
    maxZoom?: number
    totalTiles?: number
    tileType?: string
    isVector?: boolean
    error?: string
  } | null>(null)

  const isPm = isPmtilesSource(src)
  const rawUrl = src.url?.replace(/^pmtiles:\/\//, '') ?? ''

  const loadMeta = async () => {
    if (!rawUrl) return
    setLoading(true)
    setOpen(true)
    try {
      const m = await fetchPmTilesMeta(rawUrl)
      setMeta({
        minZoom: m.minZoom,
        maxZoom: m.maxZoom,
        totalTiles: m.totalTiles,
        tileType: m.tileType,
        isVector: m.isVector,
        error: m.error,
      })
      if (m.error) {
        pushToast(`Metadata: ${m.error}`, 'error')
      } else {
        pushToast('Metadata loaded', 'info')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setMeta({ error: msg })
      pushToast(`Metadata error: ${msg}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border border-border">
        <div className="flex items-start gap-2 p-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <Layers3 className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">
                {src.name || src.id}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {isPm && src.type === 'vector' ? 'pmtiles' : src.type}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate font-mono">
              {rawUrl || src.tiles?.[0] || 'inline'}
            </p>
            {src.attribution && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                © {src.attribution}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => {
              removeSource(src.id)
              pushToast(`Removed ${src.name}`, 'info')
            }}
            aria-label={`Remove ${src.name}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        {isPm && (
          <div className="border-t">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                onClick={loadMeta}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent min-h-11"
              >
                {open ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                <Info className="size-3.5 text-muted-foreground" />
                <span className="flex-1">Load metadata</span>
                {loading && <Loader2 className="size-3.5 animate-spin" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-2 text-xs">
                {meta?.error ? (
                  <div className="col-span-2 rounded-md bg-destructive/10 px-2 py-1.5 text-destructive">
                    Error: {meta.error}
                  </div>
                ) : (
                  <>
                    <MetaCell label="Min zoom" value={meta?.minZoom} />
                    <MetaCell label="Max zoom" value={meta?.maxZoom} />
                    <MetaCell label="Tile type" value={meta?.tileType} />
                    <MetaCell
                      label="Tiles"
                      value={
                        meta?.totalTiles != null
                          ? meta.totalTiles.toLocaleString()
                          : undefined
                      }
                    />
                  </>
                )}
              </div>
            </CollapsibleContent>
          </div>
        )}
      </div>
    </Collapsible>
  )
}

function MetaCell({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-md bg-muted px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-xs">
        {value != null && value !== '' ? String(value) : '—'}
      </div>
    </div>
  )
}

function AddTileSourceForm() {
  const addSource = useMapLabStore((s) => s.addSource)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const [url, setUrl] = React.useState('')
  const [name, setName] = React.useState('')
  const [type, setType] = React.useState<SourceType | 'pmtiles'>('pmtiles')
  const [attribution, setAttribution] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const submit = async () => {
    if (!url.trim()) {
      pushToast('Enter a tile URL first', 'error')
      return
    }
    setBusy(true)
    try {
      if (type === 'pmtiles') {
        addSource({
          name: name.trim() || 'PMTiles source',
          type: 'vector',
          url: pmtilesSourceUrl(url),
          attribution: attribution || undefined,
        })
      } else {
        addSource({
          name: name.trim() || `${type} source`,
          type,
          url: url,
          attribution: attribution || undefined,
        })
      }
      pushToast(`Added ${type} source`, 'success')
      setUrl('')
      setName('')
      setAttribution('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="tile-type">Type</Label>
        <Select
          value={type}
          onValueChange={(v) => setType(v as SourceType | 'pmtiles')}
        >
          <SelectTrigger id="tile-type" className="h-10">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pmtiles">PMTiles (auto)</SelectItem>
            <SelectItem value="vector">Vector (TileJSON)</SelectItem>
            <SelectItem value="raster">Raster</SelectItem>
            <SelectItem value="raster-dem">Raster DEM</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tile-name">Name</Label>
        <Input
          id="tile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My tile source"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tile-url">URL</Label>
        <Input
          id="tile-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={
            type === 'pmtiles'
              ? 'https://….pmtiles'
              : 'https://….json or {z}/{x}/{y}.png'
          }
          className="font-mono text-xs"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tile-attr">
          Attribution <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="tile-attr"
          value={attribution}
          onChange={(e) => setAttribution(e.target.value)}
          placeholder="© OpenStreetMap"
        />
      </div>
      <Button onClick={submit} disabled={busy} className="h-10">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Add tile source
      </Button>
    </div>
  )
}

export function TilesPanel() {
  const sources = useMapLabStore((s) => s.mapStyle.sources)
  const addSource = useMapLabStore((s) => s.addSource)
  const pushToast = useMapLabStore((s) => s.pushToast)

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Tile sources"
        action={
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              const first = DEMO_PMTILES[0]
              if (first) {
                addSource({
                  name: first.name,
                  type: 'vector',
                  url: pmtilesSourceUrl(first.url),
                  attribution: '© Protomaps',
                })
                pushToast(`Added ${first.name}`, 'success')
              }
            }}
          >
            <Plus className="size-4" />
            Add
          </Button>
        }
      />
      <ScrollArea className="flex-1 max-h-[calc(100vh-7rem)]">
        <div className="px-4 pb-4">
          {sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Globe2 className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">No tile sources yet</p>
              <p className="text-xs text-muted-foreground max-w-[20rem]">
                Add a PMTiles archive by URL or pick a demo source below.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sources.map((src) => (
                <TileSourceRow key={src.id} src={src} />
              ))}
            </div>
          )}
        </div>

        <Separator />
        <SectionTitle>Demos</SectionTitle>
        <div className="flex flex-col gap-1.5 px-4 pb-4">
          {DEMO_PMTILES.map((demo) => (
            <button
              key={demo.url}
              type="button"
              onClick={() => {
                addSource({
                  name: demo.name,
                  type: 'vector',
                  url: pmtilesSourceUrl(demo.url),
                  attribution: '© Protomaps',
                })
                pushToast(`Added ${demo.name}`, 'success')
              }}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-xs hover:bg-accent min-h-11"
            >
              <span className="flex-1 min-w-0">
                <span className="block truncate font-medium">{demo.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {demo.description}
                </span>
              </span>
              <Plus className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>

        <Separator />
        <SectionTitle>Add tile source</SectionTitle>
        <div className="px-4 pb-4">
          <AddTileSourceForm />
        </div>
      </ScrollArea>
    </div>
  )
}
