'use client'

// MapLab Studio — "Data" panel.
// Lists datasets (geojson + pmtiles sources) and provides an Add Dataset
// form with tabs for GeoJSON paste/file and PMTiles URL quick-pick.
// Also shows a "Saved datasets" list fetched from the backend for the current
// project, with a Load action that adds them as a source in the editor.

import * as React from 'react'
import {
  Database,
  FileJson,
  Layers,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  History,
  RefreshCw,
  AlertCircle,
  Check,
  FolderOpen,
  Clock,
  Copy,
} from 'lucide-react'
import { useMapLabStore } from '@/lib/map-store'
import { useSWR } from '@/lib/use-swr'
import { DEMO_PMTILES } from '@/lib/defaults'
import {
  pmtilesSourceUrl,
  fetchPmTilesMeta,
} from '@/lib/pmtiles-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { SourceSpec } from '@/lib/types'

interface SavedDataset {
  id: string
  name: string
  type: string // 'geojson' | 'pmtiles'
  format: string
  fileSize: number
  featureCount: number
  geometryType: string | null
  updatedAt: string
}

function useSavedDatasets(projectId: string) {
  const key = projectId === 'default' ? null : `/api/projects/${projectId}/datasets`
  const { data, loading, error, reload } = useSWR<{ datasets?: SavedDataset[] }>(key)
  const datasets = data?.datasets ?? []
  return { datasets, loading, error, reload }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function PanelHeader({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <header className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
      <div className="flex flex-col">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {hint && (
          <span className="text-xs text-muted-foreground truncate">
            {hint}
          </span>
        )}
      </div>
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

function getFeatureCount(src: SourceSpec): number | null {
  if (src.type !== 'geojson' || !src.data) return null
  if (typeof src.data === 'string') return null
  return src.data.features?.length ?? 0
}

function sourceTypeBadgeClass(type: SourceSpec['type']): string {
  // Use chart colours / muted tokens, never blue/indigo.
  switch (type) {
    case 'geojson':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    case 'vector':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
    case 'raster':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
    case 'raster-dem':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
    case 'image':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function DatasetRow({
  src,
  selected,
  onSelect,
  onRemove,
}: {
  src: SourceSpec
  selected: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const featCount = getFeatureCount(src)
  const isPmtiles =
    src.url?.startsWith('pmtiles://') ||
    (src.url != null && src.url.includes('.pmtiles'))
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border p-3 transition-colors cursor-pointer min-h-11',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:bg-accent',
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        {src.type === 'geojson' ? (
          <FileJson className="size-4" />
        ) : (
          <Layers className="size-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {src.name || src.id}
          </span>
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1', sourceTypeBadgeClass(src.type))}
          >
            {isPmtiles && src.type === 'vector' ? 'pmtiles' : src.type}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {featCount != null
            ? `${featCount} feature${featCount === 1 ? '' : 's'}`
            : src.url
              ? src.url.replace(/^pmtiles:\/\//, '')
              : 'inline data'}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        aria-label={`Remove ${src.name}`}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

function AddDatasetForm() {
  const addSource = useMapLabStore((s) => s.addSource)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const [tab, setTab] = React.useState<'geojson' | 'pmtiles'>('geojson')
  const [geojsonText, setGeojsonText] = React.useState('')
  const [geoName, setGeoName] = React.useState('')
  const [pmtilesUrl, setPmtilesUrl] = React.useState('')
  const [pmtilesName, setPmtilesName] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const submitGeojson = async () => {
    if (!geojsonText.trim()) {
      pushToast('Paste GeoJSON first', 'error')
      return
    }
    setBusy(true)
    try {
      const parsed = JSON.parse(geojsonText) as GeoJSON.FeatureCollection
      if (!parsed || parsed.type !== 'FeatureCollection') {
        throw new Error('Not a FeatureCollection')
      }
      addSource({
        name: geoName.trim() || `Dataset ${new Date().toLocaleDateString()}`,
        type: 'geojson',
        data: parsed,
      })
      pushToast(
        `Added dataset (${parsed.features.length} features)`,
        'success',
      )
      setGeojsonText('')
      setGeoName('')
    } catch (e) {
      pushToast(
        e instanceof Error ? `Invalid GeoJSON: ${e.message}` : 'Invalid GeoJSON',
        'error',
      )
    } finally {
      setBusy(false)
    }
  }

  const submitFile = async (file: File) => {
    setBusy(true)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as GeoJSON.FeatureCollection
      if (!parsed || parsed.type !== 'FeatureCollection') {
        throw new Error('Not a FeatureCollection')
      }
      addSource({
        name: geoName.trim() || file.name.replace(/\.(geo)?json$/i, ''),
        type: 'geojson',
        data: parsed,
      })
      pushToast(
        `Imported ${file.name} (${parsed.features.length} features)`,
        'success',
      )
      setGeoName('')
    } catch (e) {
      pushToast(
        e instanceof Error ? `File error: ${e.message}` : 'File error',
        'error',
      )
    } finally {
      setBusy(false)
    }
  }

  const submitPmtiles = async () => {
    if (!pmtilesUrl.trim()) {
      pushToast('Paste a PMTiles URL first', 'error')
      return
    }
    setBusy(true)
    try {
      // best-effort metadata fetch to validate the URL
      try {
        await fetchPmTilesMeta(pmtilesUrl)
      } catch {
        // metadata fetch failure is non-fatal — the protocol may still work
      }
      addSource({
        name: pmtilesName.trim() || 'PMTiles source',
        type: 'vector',
        url: pmtilesSourceUrl(pmtilesUrl),
      })
      pushToast('Added PMTiles source', 'success')
      setPmtilesUrl('')
      setPmtilesName('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="geojson">GeoJSON</TabsTrigger>
        <TabsTrigger value="pmtiles">PMTiles URL</TabsTrigger>
      </TabsList>

      <TabsContent value="geojson" className="flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="geo-name">Name</Label>
          <Input
            id="geo-name"
            value={geoName}
            onChange={(e) => setGeoName(e.target.value)}
            placeholder="My dataset"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="geo-text">Paste GeoJSON</Label>
          <Textarea
            id="geo-text"
            value={geojsonText}
            onChange={(e) => setGeojsonText(e.target.value)}
            placeholder={'{\n  "type": "FeatureCollection",\n  "features": []\n}'}
            className="font-mono text-xs min-h-32"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={submitGeojson}
            disabled={busy}
            className="h-10 flex-1"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add dataset
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".geojson,.json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) submitFile(f)
              e.target.value = ''
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="h-10"
          >
            <FileJson className="size-4" />
            File
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="pmtiles" className="flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pm-name">Name</Label>
          <Input
            id="pm-name"
            value={pmtilesName}
            onChange={(e) => setPmtilesName(e.target.value)}
            placeholder="My PMTiles source"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pm-url">PMTiles URL</Label>
          <Input
            id="pm-url"
            value={pmtilesUrl}
            onChange={(e) => setPmtilesUrl(e.target.value)}
            placeholder="https://….pmtiles"
            className="font-mono text-xs"
          />
        </div>
        <Button onClick={submitPmtiles} disabled={busy} className="h-10">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add PMTiles source
        </Button>

        <div className="mt-2 flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Quick-pick demos:</p>
          {DEMO_PMTILES.map((demo) => (
            <button
              key={demo.url}
              type="button"
              onClick={() => {
                setPmtilesUrl(demo.url)
                setPmtilesName(demo.name)
              }}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-xs hover:bg-accent min-h-11"
            >
              <span className="truncate">{demo.name}</span>
              <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  )
}

export function DataPanel() {
  const sources = useMapLabStore((s) => s.mapStyle.sources)
  const addSource = useMapLabStore((s) => s.addSource)
  const removeSource = useMapLabStore((s) => s.removeSource)
  const updateSource = useMapLabStore((s) => s.updateSource)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const project = useMapLabStore((s) => s.project)
  // Track which source is "selected" via a local hook into the active layer
  // (datasets don't have a dedicated store field; we just visually highlight).
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [loadingDatasetId, setLoadingDatasetId] = React.useState<string | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = React.useState<SavedDataset | null>(
    null,
  )
  const [deleting, setDeleting] = React.useState(false)
  const { datasets: savedDatasets, loading, error, reload } =
    useSavedDatasets(project.id)

  const datasets = sources

  // Load a saved dataset into the editor — for geojson, fetch the inline
  // FeatureCollection via /api/datasets/{id}/geojson and add it as a geojson
  // source. For pmtiles, fetch the full row via /api/datasets/{id} (which
  // includes the URL stored in the `data` column) and add it as a vector
  // source with the pmtiles:// protocol prefix.
  const loadDataset = React.useCallback(
    async (d: SavedDataset) => {
      setLoadingDatasetId(d.id)
      try {
        if (d.type === 'geojson') {
          // Fetch the inline GeoJSON FeatureCollection.
          const res = await fetch(`/api/datasets/${d.id}/geojson`)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const fc = (await res.json()) as GeoJSON.FeatureCollection
          addSource({
            name: d.name,
            type: 'geojson',
            data: fc,
          })
          pushToast(`Loaded dataset "${d.name}"`, 'success')
        } else {
          // pmtiles — fetch the full dataset row (including the URL stored
          // in the `data` column) via GET /api/datasets/{id}, then add it
          // as a vector source with the pmtiles:// protocol prefix.
          const res = await fetch(`/api/datasets/${d.id}`)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = (await res.json()) as {
            dataset?: { data?: string }
          }
          const url = data.dataset?.data
          if (!url || typeof url !== 'string') {
            throw new Error('Dataset has no URL')
          }
          addSource({
            name: d.name,
            type: 'vector',
            url: pmtilesSourceUrl(url),
          })
          pushToast(`Loaded PMTiles dataset "${d.name}"`, 'success')
        }
      } catch (e) {
        pushToast(
          `Load failed: ${e instanceof Error ? e.message : String(e)}`,
          'error',
        )
      } finally {
        setLoadingDatasetId(null)
      }
    },
    [addSource, pushToast],
  )

  // Duplicate a saved dataset: fetch the full row, then POST it as a new
  // row with " (copy)" appended to the name.
  const duplicateDataset = React.useCallback(
    async (d: SavedDataset) => {
      setLoadingDatasetId(d.id)
      try {
        const res = await fetch(`/api/datasets/${d.id}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as {
          dataset?: { data?: unknown; type?: string }
        }
        const dupRes = await fetch(
          `/api/projects/${project.id}/datasets?dedup=false`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `${d.name} (copy)`,
              type: d.type,
              data: data.dataset?.data,
            }),
          },
        )
        if (!dupRes.ok) throw new Error(`POST failed: ${dupRes.status}`)
        pushToast(`Duplicated dataset "${d.name}"`, 'success')
        reload()
      } catch (e) {
        pushToast(
          `Duplicate failed: ${e instanceof Error ? e.message : String(e)}`,
          'error',
        )
      } finally {
        setLoadingDatasetId(null)
      }
    },
    [project.id, pushToast, reload],
  )

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Datasets"
        hint={`${datasets.length} source${datasets.length === 1 ? '' : 's'}`}
        action={
          <Button variant="outline" size="sm" className="h-8" onClick={() => {
            addSource({
              name: 'New GeoJSON dataset',
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] },
            })
            pushToast('Empty dataset created', 'info')
          }}>
            <Plus className="size-4" />
            Empty
          </Button>
        }
      />
      <ScrollArea className="flex-1 max-h-[calc(100vh-7rem)]">
        <div className="px-4 pb-4">
          {datasets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Database className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">No datasets yet</p>
              <p className="text-xs text-muted-foreground max-w-[20rem]">
                Add GeoJSON by pasting or uploading a file, or attach a PMTiles
                archive by URL.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {datasets.map((src) => (
                <DatasetRow
                  key={src.id}
                  src={src}
                  selected={activeId === src.id}
                  onSelect={() => {
                    setActiveId(src.id)
                    updateSource(src.id, {}) // touch to mark dirty
                  }}
                  onRemove={() => {
                    removeSource(src.id)
                    if (activeId === src.id) setActiveId(null)
                    pushToast(`Removed ${src.name}`, 'info')
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Saved datasets (from the backend) */}
        {project.id !== 'default' && (
          <>
            <Separator />
            <SectionTitle>Saved datasets</SectionTitle>
            <div className="px-4 pb-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {loading
                    ? 'Loading…'
                    : error
                      ? 'Failed to load'
                      : `${savedDatasets.length} dataset${savedDatasets.length === 1 ? '' : 's'}`}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={reload}
                      aria-label="Refresh datasets"
                    >
                      <RefreshCw
                        className={cn('size-3', loading && 'animate-spin')}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh</TooltipContent>
                </Tooltip>
              </div>
              {error ? (
                <div className="rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 px-2 py-1.5 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                  <AlertCircle className="size-3 shrink-0 mt-0.5" />
                  <span className="break-all">{error}</span>
                </div>
              ) : savedDatasets.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic px-1 py-2">
                  No saved datasets yet. Save the project first, then datasets
                  added via the form below will be persisted.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {savedDatasets.slice(0, 8).map((d) => (
                    <div
                      key={d.id}
                      className="rounded-md border px-2 py-1.5 text-xs hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate flex items-center gap-1.5">
                          <FileJson className="size-3 text-muted-foreground" />
                          {d.name}
                        </span>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1 capitalize">
                          {d.type}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                        <Clock className="size-2.5" />
                        {new Date(d.updatedAt).toLocaleDateString()}
                        <span>·</span>
                        {d.featureCount > 0 && (
                          <span>{d.featureCount} feat</span>
                        )}
                        {d.geometryType && (
                          <>
                            <span>·</span>
                            <span>{d.geometryType}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{formatBytes(d.fileSize)}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] flex-1"
                          disabled={loadingDatasetId === d.id}
                          onClick={() => void loadDataset(d)}
                        >
                          {loadingDatasetId === d.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <FolderOpen className="size-3" />
                          )}
                          Load
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              disabled={loadingDatasetId === d.id}
                              onClick={() => void duplicateDataset(d)}
                              aria-label={`Duplicate dataset ${d.name}`}
                            >
                              <Copy className="size-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicate</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 text-destructive hover:text-destructive"
                              disabled={loadingDatasetId === d.id}
                              onClick={() => setDeleteTarget(d)}
                              aria-label={`Delete dataset ${d.name}`}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <Separator />
        <SectionTitle>Add dataset</SectionTitle>
        <div className="px-4 pb-4">
          <AddDatasetForm />
        </div>
      </ScrollArea>

      {/* Delete dataset confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete dataset?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{deleteTarget?.name}</strong> from
              the backend. Layers using this dataset as a source will keep their
              in-memory data, but reloading the project will lose it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async () => {
                if (!deleteTarget) return
                setDeleting(true)
                try {
                  const res = await fetch(
                    `/api/datasets/${deleteTarget.id}`,
                    { method: 'DELETE' },
                  )
                  if (!res.ok) throw new Error(`HTTP ${res.status}`)
                  pushToast(`Deleted "${deleteTarget.name}"`, 'success')
                  setDeleteTarget(null)
                  reload()
                } catch (e) {
                  pushToast(
                    `Delete failed: ${e instanceof Error ? e.message : String(e)}`,
                    'error',
                  )
                } finally {
                  setDeleting(false)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <Trash2 className="size-3.5 mr-1" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
