'use client'

// MapLab Studio — Import dialog.
// Three tabs: GeoJSON (paste / file), PMTiles (URL / quick-pick), Mapbox Style
// (URL). All three wire to real backend / store behaviour.

import * as React from 'react'
import {
  Upload,
  FileJson,
  Boxes,
  Globe2,
  Check,
  Link as LinkIcon,
  FileText,
  Loader2,
} from 'lucide-react'

import { useMapLabStore } from '@/lib/map-store'
import { DEMO_PMTILES } from '@/lib/defaults'
import { pmtilesSourceUrl } from '@/lib/pmtiles-helpers'
import { fromMapboxStyle } from '@/lib/map-style'
import type { SourceSpec } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

type ImportKind = 'geojson' | 'pmtiles' | 'mapboxstyle'

export function ImportDialog() {
  const open = useMapLabStore((s) => s.importOpen)
  const setOpen = useMapLabStore((s) => s.setImportOpen)
  const addSource = useMapLabStore((s) => s.addSource)
  const selectLayer = useMapLabStore((s) => s.selectLayer)
  const loadStyle = useMapLabStore((s) => s.loadStyle)
  const pushToast = useMapLabStore((s) => s.pushToast)

  const [tab, setTab] = React.useState<ImportKind>('geojson')

  // GeoJSON state
  const [geojsonText, setGeojsonText] = React.useState('')
  const [geojsonName, setGeojsonName] = React.useState('Imported GeoJSON')
  const [geojsonErr, setGeojsonErr] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement | null>(null)

  // PMTiles state
  const [pmtilesUrl, setPmtilesUrl] = React.useState('')
  const [pmtilesName, setPmtilesName] = React.useState('Imported PMTiles')

  // Mapbox style state
  const [styleUrl, setStyleUrl] = React.useState('')
  const [styleName, setStyleName] = React.useState('Imported Style')

  const close = () => {
    setOpen(false)
    setTimeout(() => {
      setGeojsonText('')
      setGeojsonErr(null)
      setPmtilesUrl('')
      setStyleUrl('')
    }, 200)
  }

  // ---- handlers ----

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      setGeojsonText(String(reader.result ?? ''))
      setGeojsonName(file.name.replace(/\.(geo)?json$/i, '') || 'Imported GeoJSON')
    }
    reader.onerror = () => {
      setGeojsonErr('Could not read file')
    }
    reader.readAsText(file)
  }

  const submitGeojson = () => {
    setGeojsonErr(null)
    const text = geojsonText.trim()
    if (!text) {
      setGeojsonErr('Paste some GeoJSON or pick a file')
      return
    }
    let data: GeoJSON.FeatureCollection
    try {
      data = JSON.parse(text) as GeoJSON.FeatureCollection
    } catch (e) {
      setGeojsonErr(e instanceof Error ? e.message : 'Invalid JSON')
      return
    }
    if (!data || data.type !== 'FeatureCollection') {
      setGeojsonErr('Expected a GeoJSON FeatureCollection')
      return
    }
    const id = addSource({
      type: 'geojson',
      name: geojsonName.trim() || 'Imported GeoJSON',
      data,
    } as Partial<SourceSpec>)
    // Select the new source's first layer if any. We don't auto-create layers
    // here; user can add layers manually. Just toast.
    void id
    pushToast('GeoJSON imported as a source', 'success')
    close()
  }

  const submitPmtiles = () => {
    const url = pmtilesUrl.trim()
    if (!url) {
      pushToast('Enter a PMTiles URL', 'error')
      return
    }
    const id = addSource({
      type: 'vector',
      name: pmtilesName.trim() || 'Imported PMTiles',
      url: pmtilesSourceUrl(url),
    } as Partial<SourceSpec>)
    void id
    pushToast('PMTiles source added', 'success')
    close()
  }

  const [importingStyle, setImportingStyle] = React.useState(false)
  const submitStyle = async () => {
    const url = styleUrl.trim()
    if (!url) {
      pushToast('Enter a style URL', 'error')
      return
    }
    setImportingStyle(true)
    try {
      // Try a direct fetch first (works for hosts that send CORS headers
      // like demotiles.maplibre.org and CARTO). If that fails, fall back to
      // our /api/proxy?url= route which streams the upstream response with
      // `Access-Control-Allow-Origin: *` injected.
      let res: Response | null = null
      let lastErr: unknown = null
      try {
        res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } catch (e) {
        lastErr = e
        // Try the proxy fallback.
        const proxied = `/api/proxy?url=${encodeURIComponent(url)}`
        const proxyRes = await fetch(proxied)
        if (!proxyRes.ok) {
          throw new Error(
            `Direct fetch failed (${e instanceof Error ? e.message : 'unknown'}) and proxy returned ${proxyRes.status}`,
          )
        }
        res = proxyRes
      }
      if (!res) {
        throw new Error(
          lastErr instanceof Error ? lastErr.message : 'No response',
        )
      }
      const json = await res.json()
      const name = styleName.trim() || (json.name as string | undefined) || 'Imported style'
      const internal = fromMapboxStyle(json, `imported-${Date.now()}`)
      // Preserve the user-chosen name + the original sprite/glyphs.
      internal.name = name
      loadStyle(internal)
      selectLayer(internal.layers[0]?.id ?? null)
      pushToast(`Imported style "${name}"`, 'success')
      close()
    } catch (e) {
      pushToast(
        `Import failed: ${e instanceof Error ? e.message : String(e)}`,
        'error',
      )
    } finally {
      setImportingStyle(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : close())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4" />
            Import data
          </DialogTitle>
          <DialogDescription>
            Add GeoJSON, PMTiles or import a full Mapbox Style URL.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ImportKind)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="geojson">
              <FileJson className="size-3.5" />
              GeoJSON
            </TabsTrigger>
            <TabsTrigger value="pmtiles">
              <Boxes className="size-3.5" />
              PMTiles
            </TabsTrigger>
            <TabsTrigger value="mapboxstyle">
              <Globe2 className="size-3.5" />
              Mapbox Style
            </TabsTrigger>
          </TabsList>

          {/* ---- GeoJSON ---- */}
          <TabsContent value="geojson" className="pt-3">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Source name
                  </Label>
                  <Input
                    value={geojsonName}
                    onChange={(e) => setGeojsonName(e.target.value)}
                    placeholder="My imported data"
                    className="h-8"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    File
                  </Label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".geojson,.json,application/geo+json,application/json"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleFile(f)
                    }}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => fileRef.current?.click()}
                  >
                    <FileText className="size-3.5" />
                    Choose file
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  GeoJSON (paste FeatureCollection)
                </Label>
                <Textarea
                  value={geojsonText}
                  onChange={(e) => setGeojsonText(e.target.value)}
                  placeholder={'{ "type": "FeatureCollection", "features": [...] }'}
                  className="h-40 text-xs font-mono"
                />
              </div>

              {geojsonErr ? (
                <p className="text-xs text-destructive">{geojsonErr}</p>
              ) : null}

              <div className="flex justify-end">
                <Button size="sm" onClick={submitGeojson}>
                  <Check className="size-3.5" />
                  Add source
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ---- PMTiles ---- */}
          <TabsContent value="pmtiles" className="pt-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Source name
                </Label>
                <Input
                  value={pmtilesName}
                  onChange={(e) => setPmtilesName(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  PMTiles URL
                </Label>
                <div className="flex items-center gap-2">
                  <LinkIcon className="size-3.5 text-muted-foreground" />
                  <Input
                    value={pmtilesUrl}
                    onChange={(e) => setPmtilesUrl(e.target.value)}
                    placeholder="https://example.com/data.pmtiles"
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Quick-pick demos
                </Label>
                <ScrollArea className="max-h-40 rounded-md border">
                  <div className="flex flex-col">
                    {DEMO_PMTILES.map((d) => (
                      <button
                        key={d.url}
                        type="button"
                        onClick={() => {
                          setPmtilesUrl(d.url)
                          setPmtilesName(d.name)
                        }}
                        className="text-left px-3 py-2 hover:bg-accent border-b last:border-b-0 transition-colors"
                      >
                        <div className="text-xs font-medium flex items-center gap-1.5">
                          <Boxes className="size-3.5" />
                          {d.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {d.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={submitPmtiles} disabled={!pmtilesUrl}>
                  <Check className="size-3.5" />
                  Add source
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ---- Mapbox Style ---- */}
          <TabsContent value="mapboxstyle" className="pt-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Style name
                </Label>
                <Input
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Style URL (Mapbox / MapLibre v8)
                </Label>
                <div className="flex items-center gap-2">
                  <Globe2 className="size-3.5 text-muted-foreground" />
                  <Input
                    value={styleUrl}
                    onChange={(e) => setStyleUrl(e.target.value)}
                    placeholder="https://demotiles.maplibre.org/style.json"
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Fetches the style JSON and replaces the current style. If a
                direct fetch fails due to CORS, MapLab will retry through the
                built-in <code className="font-mono">/api/proxy</code> route.
              </p>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={submitStyle}
                  disabled={!styleUrl.trim() || importingStyle}
                >
                  {importingStyle ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      Import style
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ImportDialog
