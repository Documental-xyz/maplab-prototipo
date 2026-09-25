'use client'

// MapLab Studio — "Styles" panel.
// Manage the active style: list + save (POST /api/projects/{id}/styles) +
// import Mapbox style (fetch + fromMapboxStyle + loadStyle, with /api/proxy
// fallback for CORS) + export as Mapbox style JSON (works end-to-end via
// Blob).

import * as React from 'react'
import {
  Plus,
  Save,
  Download,
  Upload,
  FileJson,
  Layers,
  Database,
  Loader2,
  ChevronDown,
  ChevronRight,
  History,
  RefreshCw,
  Check,
  Clock,
  Copy,
  RotateCcw,
} from 'lucide-react'
import { useMapLabStore } from '@/lib/map-store'
import { useSWR } from '@/lib/use-swr'
import { fromMapboxStyle } from '@/lib/map-style'
import type { MapStyle } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SavedStyle {
  id: string
  name: string
  isPublished: boolean
  updatedAt: string
}

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

/**
 * useSaveStyle — persists the current style to the backend.
 * POSTs a new style under the current project (each save creates a new
 * style row; the project's style list is the version history).
 */
function useSaveStyle() {
  return React.useCallback(async () => {
    const mapStyle = useMapLabStore.getState().mapStyle
    const proj = useMapLabStore.getState().project
    let projectId = proj.id
    // Create the project first if it doesn't exist yet.
    if (projectId === 'default') {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: proj.name, description: proj.description }),
      })
      if (!res.ok) throw new Error(`POST /api/projects failed: ${res.status}`)
      const created = (await res.json()) as
        | { project?: { id: string } }
        | { id: string }
      projectId =
        ('project' in created && created.project?.id) ||
        ('id' in created && created.id) ||
        ''
      if (!projectId) throw new Error('Server returned no project id')
      useMapLabStore.getState().setProject({ id: projectId })
    }
    const styleRes = await fetch(`/api/projects/${projectId}/styles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: mapStyle.name, spec: mapStyle }),
    })
    if (!styleRes.ok) throw new Error(`POST styles failed: ${styleRes.status}`)
    const styleJson = (await styleRes.json()) as
      | { style?: { id: string } }
      | { id: string }
    const styleId =
      ('style' in styleJson && styleJson.style?.id) ||
      ('id' in styleJson && styleJson.id) ||
      ''
    return { ok: true as const, styleId }
  }, [])
}

/**
 * useSavedStyles — fetches the list of saved styles for the current project.
 * Used to populate the "Recent styles" list.
 */
function useSavedStyles(projectId: string) {
  const key = projectId === 'default' ? null : `/api/projects/${projectId}/styles`
  const { data, loading, error, reload } = useSWR<{ styles?: SavedStyle[] }>(key)
  return {
    styles: data?.styles ?? [],
    loading,
    error,
    reload,
  }
}

function StyleRow() {
  const mapStyle = useMapLabStore((s) => s.mapStyle)
  const [open, setOpen] = React.useState(true)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border border-border">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 p-3 text-left hover:bg-accent rounded-md min-h-11"
          >
            {open ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {mapStyle.name}
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  active
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {mapStyle.layers.length} layers · {mapStyle.sources.length} sources
              </p>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-3 py-2 flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1.5">
                <Layers className="size-3.5 text-muted-foreground" />
                <span>{mapStyle.layers.length} layers</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1.5">
                <Database className="size-3.5 text-muted-foreground" />
                <span>{mapStyle.sources.length} sources</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <FileJson className="size-3" />
              <span className="font-mono truncate">id: {mapStyle.id}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="font-mono">v{mapStyle.version}</span>
              <span>·</span>
              <span>
                center [{mapStyle.view.center[0].toFixed(2)}, {mapStyle.view.center[1].toFixed(2)}]
              </span>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function ImportMapboxStyleForm() {
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState('')
  const [importing, setImporting] = React.useState(false)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const loadStyle = useMapLabStore((s) => s.loadStyle)
  const selectLayer = useMapLabStore((s) => s.selectLayer)
  const fileRef = React.useRef<HTMLInputElement>(null)

  // Fetch a style JSON from a URL, with /api/proxy fallback for CORS.
  const fetchStyleJson = async (rawUrl: string): Promise<Record<string, unknown>> => {
    let res: Response | null = null
    try {
      res = await fetch(rawUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      // Retry via the proxy.
      const proxied = `/api/proxy?url=${encodeURIComponent(rawUrl)}`
      const proxyRes = await fetch(proxied)
      if (!proxyRes.ok) {
        throw new Error(
          `Direct fetch failed (${e instanceof Error ? e.message : 'unknown'}) and proxy returned ${proxyRes.status}`,
        )
      }
      res = proxyRes
    }
    return (await res.json()) as Record<string, unknown>
  }

  const onImportUrl = async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      pushToast('Paste a style URL first', 'error')
      return
    }
    setImporting(true)
    try {
      const json = await fetchStyleJson(trimmed)
      const name =
        (typeof json.name === 'string' && json.name) || 'Imported style'
      const internal = fromMapboxStyle(
        json as unknown as Parameters<typeof fromMapboxStyle>[0],
        `imported-${Date.now()}`,
      )
      internal.name = name
      loadStyle(internal)
      selectLayer(internal.layers[0]?.id ?? null)
      pushToast(`Imported style "${name}"`, 'success')
      setUrl('')
      setOpen(false)
    } catch (e) {
      pushToast(
        `Import failed: ${e instanceof Error ? e.message : String(e)}`,
        'error',
      )
    } finally {
      setImporting(false)
    }
  }

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const json = JSON.parse(text) as Record<string, unknown>
      const name =
        (typeof json.name === 'string' && json.name) || file.name
      const internal = fromMapboxStyle(
        json as unknown as Parameters<typeof fromMapboxStyle>[0],
        `imported-${Date.now()}`,
      )
      internal.name = name
      loadStyle(internal)
      selectLayer(internal.layers[0]?.id ?? null)
      pushToast(`Imported ${file.name}`, 'success')
      setOpen(false)
    } catch (e) {
      pushToast(
        e instanceof Error ? `Invalid file: ${e.message}` : 'Invalid file',
        'error',
      )
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="h-11 w-full justify-start">
          <Upload className="size-4" />
          Import Mapbox style
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 flex flex-col gap-2 rounded-md border border-border p-3">
          <Label htmlFor="mbx-url">Style URL</Label>
          <Input
            id="mbx-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://….json"
            className="font-mono text-xs"
          />
          <Button
            size="sm"
            onClick={onImportUrl}
            disabled={importing || !url.trim()}
            className="h-9"
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Import URL
          </Button>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onImportFile(f)
                e.target.value = ''
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              className="h-9 flex-1"
            >
              <FileJson className="size-4" />
              Upload .json
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Replaces the current style. Falls back to <code className="font-mono">/api/proxy</code> on CORS errors.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ExportButton() {
  const exportMapboxStyle = useMapLabStore((s) => s.exportMapboxStyle)
  const project = useMapLabStore((s) => s.project)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const [busy, setBusy] = React.useState(false)

  const handleExport = () => {
    setBusy(true)
    try {
      const doc = exportMapboxStyle()
      const json = JSON.stringify(doc, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const safeName = (
        project.name.trim() || 'maplab-style'
      ).replace(/[^a-z0-9-_]+/gi, '-')
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeName}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // revoke a tick later so the download has time to start
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      pushToast('Style exported as Mapbox JSON', 'success')
    } catch (e) {
      pushToast(
        e instanceof Error ? `Export failed: ${e.message}` : 'Export failed',
        'error',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant="default"
      onClick={handleExport}
      disabled={busy}
      className="h-11 w-full justify-start"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      Export Mapbox style
    </Button>
  )
}

function SaveButton() {
  const mapStyle = useMapLabStore((s) => s.mapStyle)
  const project = useMapLabStore((s) => s.project)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const save = useSaveStyle()
  const [busy, setBusy] = React.useState(false)

  const handleSave = async () => {
    setBusy(true)
    try {
      const result = await save()
      pushToast('Style saved', 'success')
      console.log('[MapLab] style saved', {
        projectId: project.id,
        styleId: result.styleId,
        mapStyleId: mapStyle.id,
      })
    } catch (e) {
      pushToast(
        `Save failed: ${e instanceof Error ? e.message : String(e)}`,
        'error',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleSave}
      disabled={busy}
      className="h-11 w-full justify-start"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
      Save style
    </Button>
  )
}

/**
 * RecentStylesList — lists the saved style versions for the current project,
 * fetched from GET /api/projects/{id}/styles. Clicking a row loads that
 * style's spec via GET /api/styles/{id} and calls loadStyle().
 */
function RecentStylesList() {
  const project = useMapLabStore((s) => s.project)
  const loadStyle = useMapLabStore((s) => s.loadStyle)
  const selectLayer = useMapLabStore((s) => s.selectLayer)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const { styles, loading, error, reload } = useSavedStyles(project.id)
  const [loadingStyleId, setLoadingStyleId] = React.useState<string | null>(
    null,
  )

  if (project.id === 'default') {
    return (
      <p className="text-[11px] text-muted-foreground italic px-4 pb-2">
        Save the project first to see its style history.
      </p>
    )
  }

  return (
    <div className="px-4 pb-2 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {loading
            ? 'Loading…'
            : error
              ? 'Failed to load'
              : `${styles.length} style${styles.length === 1 ? '' : 's'}`}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={reload}
              aria-label="Refresh styles"
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
        <div className="rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 px-2 py-1.5 text-[11px] text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : styles.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic px-1 py-2">
          No saved styles yet. Click "Save style" below to create the first
          version.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {styles.slice(0, 8).map((s, i) => (
            <div
              key={s.id}
              className="rounded-md border px-2 py-1.5 text-xs hover:bg-accent/50 transition-colors"
            >
              <button
                type="button"
                disabled={loadingStyleId === s.id}
                onClick={async () => {
                  setLoadingStyleId(s.id)
                  try {
                    const res = await fetch(`/api/styles/${s.id}`)
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                    const data = (await res.json()) as {
                      style?: { name: string; spec?: Parameters<typeof loadStyle>[0] }
                    }
                    const spec = data.style?.spec
                    if (!spec) throw new Error('No spec in response')
                    // Preserve the original name from the row (more reliable
                    // than the serialized spec's name).
                    if (data.style?.name) spec.name = data.style.name
                    loadStyle(spec)
                    selectLayer(spec.layers[0]?.id ?? null)
                    pushToast(`Loaded style "${s.name}"`, 'success')
                  } catch (e) {
                    pushToast(
                      `Load failed: ${e instanceof Error ? e.message : String(e)}`,
                      'error',
                    )
                  } finally {
                    setLoadingStyleId(null)
                  }
                }}
                className="text-left w-full"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate flex items-center gap-1.5">
                    {i === 0 && (
                      <Badge variant="default" className="text-[9px] h-4 px-1">
                        <Check className="size-2.5 mr-0.5" />
                        latest
                      </Badge>
                    )}
                    {s.name}
                  </span>
                  {s.isPublished && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">
                      published
                    </Badge>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                  <Clock className="size-2.5" />
                  {new Date(s.updatedAt).toLocaleString()}
                </div>
              </button>
              {/* Row actions: Duplicate (creates a new style row from this
                  version's spec) + Restore (loads the spec into the editor
                  without creating a new row — user can edit + save). */}
              <div className="flex items-center gap-1 mt-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] flex-1"
                  disabled={loadingStyleId === s.id}
                  onClick={async () => {
                    setLoadingStyleId(s.id)
                    try {
                      // 1. Fetch the spec.
                      const res = await fetch(`/api/styles/${s.id}`)
                      if (!res.ok) throw new Error(`HTTP ${res.status}`)
                      const data = (await res.json()) as {
                        style?: { name: string; spec?: MapStyle }
                      }
                      const spec = data.style?.spec
                      if (!spec) throw new Error('No spec in response')
                      // 2. POST it as a new style row under the same project,
                      // with " (duplicate)" appended to the name.
                      const dupRes = await fetch(
                        `/api/projects/${project.id}/styles`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: `${s.name} (duplicate)`,
                            spec: { ...spec, name: `${s.name} (duplicate)` },
                          }),
                        },
                      )
                      if (!dupRes.ok) {
                        throw new Error(`POST styles failed: ${dupRes.status}`)
                      }
                      pushToast(
                        `Duplicated style "${s.name}"`,
                        'success',
                      )
                      reload()
                    } catch (e) {
                      pushToast(
                        `Duplicate failed: ${e instanceof Error ? e.message : String(e)}`,
                        'error',
                      )
                    } finally {
                      setLoadingStyleId(null)
                    }
                  }}
                >
                  <Copy className="size-3" />
                  Duplicate
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px]"
                      disabled={loadingStyleId === s.id}
                      onClick={async () => {
                        setLoadingStyleId(s.id)
                        try {
                          const res = await fetch(`/api/styles/${s.id}`)
                          if (!res.ok) throw new Error(`HTTP ${res.status}`)
                          const data = (await res.json()) as {
                            style?: { name: string; spec?: Parameters<typeof loadStyle>[0] }
                          }
                          const spec = data.style?.spec
                          if (!spec) throw new Error('No spec in response')
                          if (data.style?.name) spec.name = data.style.name
                          // Restore = load into the editor buffer WITHOUT
                          // creating a new style row. The user can tweak and
                          // then click "Save style" to persist as a new row.
                          loadStyle(spec)
                          selectLayer(spec.layers[0]?.id ?? null)
                          pushToast(
                            `Restored "${s.name}" to editor (click Save to persist)`,
                            'info',
                          )
                        } catch (e) {
                          pushToast(
                            `Restore failed: ${e instanceof Error ? e.message : String(e)}`,
                            'error',
                          )
                        } finally {
                          setLoadingStyleId(null)
                        }
                      }}
                    >
                      <RotateCcw className="size-3" />
                      Restore
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Load this version into the editor without creating a new
                    saved row
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function StylesPanel() {
  const newStyle = useMapLabStore((s) => s.newStyle)
  const pushToast = useMapLabStore((s) => s.pushToast)

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Styles"
        action={
          <Button
            variant="default"
            size="sm"
            className="h-8"
            onClick={() => {
              newStyle()
              pushToast('New style created', 'success')
            }}
          >
            <Plus className="size-4" />
            New
          </Button>
        }
      />
      <ScrollArea className="flex-1 max-h-[calc(100vh-7rem)]">
        <div className="flex flex-col gap-2 px-4 pb-4">
          <StyleRow />
        </div>

        <Separator />

        <SectionTitle>Recent styles</SectionTitle>
        <RecentStylesList />

        <Separator />
        <SectionTitle>Actions</SectionTitle>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <SaveButton />
          <ImportMapboxStyleForm />
          <ExportButton />
        </div>
      </ScrollArea>
    </div>
  )
}
