'use client'

// MapLab Studio — "API" panel.
// Lists every backend endpoint with copy-to-clipboard buttons, plus a
// disabled API key field (self-hosted: no key needed).

import * as React from 'react'
import {
  Copy,
  Check,
  KeyRound,
  Lock,
  Code2,
  ArrowRight,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface Endpoint {
  method: Method
  path: string
  description: string
  resource: 'projects' | 'styles' | 'datasets' | 'tilesources' | 'search' | 'routing'
}

const ENDPOINTS: Endpoint[] = [
  // Projects
  {
    method: 'GET',
    path: '/api/projects',
    description: 'List all projects (with style/dataset/source counts).',
    resource: 'projects',
  },
  {
    method: 'POST',
    path: '/api/projects',
    description: 'Create a new project.',
    resource: 'projects',
  },
  {
    method: 'GET',
    path: '/api/projects/{id}',
    description: 'Get a project by id (metadata + style summary).',
    resource: 'projects',
  },
  {
    method: 'PATCH',
    path: '/api/projects/{id}',
    description: 'Update a project name/description.',
    resource: 'projects',
  },
  {
    method: 'DELETE',
    path: '/api/projects/{id}',
    description: 'Delete a project (cascades styles/datasets/sources).',
    resource: 'projects',
  },
  // Styles
  {
    method: 'GET',
    path: '/api/projects/{id}/styles',
    description: 'List styles for a project.',
    resource: 'styles',
  },
  {
    method: 'POST',
    path: '/api/projects/{id}/styles',
    description: 'Save a new style (MapLibre v8 spec) under a project.',
    resource: 'styles',
  },
  {
    method: 'GET',
    path: '/api/styles/{id}/export',
    description: 'Download a style as a Mapbox v8 JSON document.',
    resource: 'styles',
  },
  {
    method: 'POST',
    path: '/api/styles/{id}/publish',
    description: 'Mark a style as published.',
    resource: 'styles',
  },
  // Datasets
  {
    method: 'POST',
    path: '/api/projects/{id}/datasets',
    description: 'Add a dataset (GeoJSON or PMTiles URL).',
    resource: 'datasets',
  },
  {
    method: 'GET',
    path: '/api/datasets/{id}/geojson',
    description: 'Get a dataset as a GeoJSON FeatureCollection.',
    resource: 'datasets',
  },
  {
    method: 'DELETE',
    path: '/api/datasets/{id}',
    description: 'Delete a dataset.',
    resource: 'datasets',
  },
  // Tile sources
  {
    method: 'GET',
    path: '/api/projects/{id}/tilesources',
    description: 'List all configured tile sources.',
    resource: 'tilesources',
  },
  {
    method: 'POST',
    path: '/api/projects/{id}/tilesources',
    description: 'Add a tile source (PMTiles, raster, vector, raster-dem).',
    resource: 'tilesources',
  },
  // Search / Routing
  {
    method: 'GET',
    path: '/api/search?q=',
    description: 'Forward geocoding (place name → coordinates).',
    resource: 'search',
  },
  {
    method: 'GET',
    path: '/api/route-plan?from=&to=&profile=',
    description: 'Plan a route between two coordinates (OSRM).',
    resource: 'routing',
  },
  {
    method: 'GET',
    path: '/api/pmtiles/proxy?url=&offset=&length=',
    description: 'Range-request proxy for CORS-restricted PMTiles hosts.',
    resource: 'tilesources',
  },
]

const RESOURCE_LABELS: Record<Endpoint['resource'], { label: string; description: string }> = {
  projects: { label: 'Projects', description: 'CRUD for map projects.' },
  styles: {
    label: 'Styles',
    description: 'MapLibre v8 style documents + export + publish.',
  },
  datasets: {
    label: 'Datasets',
    description: 'User-supplied GeoJSON + PMTiles.',
  },
  tilesources: {
    label: 'Tile sources & proxy',
    description: 'Vector/raster/PMTiles sources + CORS proxy.',
  },
  search: { label: 'Search', description: 'Nominatim geocoding proxy.' },
  routing: { label: 'Routing', description: 'OSRM routing proxy.' },
}

const RESOURCE_ORDER: Endpoint['resource'][] = [
  'projects',
  'styles',
  'datasets',
  'tilesources',
  'search',
  'routing',
]

function PanelHeader({ title }: { title: string }) {
  return (
    <header className="px-4 pt-4 pb-2">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5">
        Self-hosted REST API — no key required.
      </p>
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

function methodClass(m: Method): string {
  // NO blue/indigo. Use emerald / amber / violet / rose.
  switch (m) {
    case 'GET':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    case 'POST':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
    case 'PATCH':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
    case 'DELETE':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
  }
}

function useCopy() {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)
  const copy = React.useCallback(async (key: string, text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-secure contexts.
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch {
      // ignore
    }
  }, [])
  return { copiedKey, copy }
}

function ApiKeyField() {
  return (
    <div className="flex flex-col gap-2 px-4">
      <Label htmlFor="api-key" className="flex items-center gap-1.5">
        <KeyRound className="size-3.5" />
        API key
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full">
            <Input
              id="api-key"
              value="self-hosted · no key needed"
              disabled
              className="font-mono text-xs h-10"
              readOnly
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          MapLab is self-hosted — requests are not authenticated.
        </TooltipContent>
      </Tooltip>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Lock className="size-3" />
        <span>All endpoints are open in this preview build.</span>
      </div>
    </div>
  )
}

function EndpointRow({
  endpoint,
  onCopy,
  copied,
  isActive = false,
}: {
  endpoint: Endpoint
  onCopy: (path: string) => void
  copied: boolean
  isActive?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border p-2 transition-colors',
        isActive
          ? 'border-primary bg-accent/70'
          : 'border-border hover:bg-accent/50',
      )}
    >
      <Badge
        variant="outline"
        className={cn('font-mono text-[10px] px-1.5 mt-0.5', methodClass(endpoint.method))}
      >
        {endpoint.method}
      </Badge>
      <div className="flex-1 min-w-0">
        <code className="block font-mono text-xs break-all leading-relaxed">
          {endpoint.path}
        </code>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {endpoint.description}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={() => onCopy(endpoint.path)}
        aria-label={`Copy ${endpoint.method} ${endpoint.path}`}
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-600" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </Button>
    </div>
  )
}

function CurlCard({
  endpoint,
  onCopy,
  copied,
}: {
  endpoint: Endpoint
  onCopy: (text: string) => void
  copied: boolean
}) {
  const curl = `curl -X ${endpoint.method} '${endpoint.path}'`
  return (
    <div className="rounded-md border border-border bg-muted/40 overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/60">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Code2 className="size-3" />
          <span>cURL</span>
        </div>
        <button
          type="button"
          onClick={() => onCopy(curl)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          aria-label="Copy cURL"
        >
          {copied ? (
            <Check className="size-3 text-emerald-600" />
          ) : (
            <Copy className="size-3" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="px-3 py-2 text-[11px] font-mono overflow-x-auto">
        <code>{curl}</code>
      </pre>
    </div>
  )
}

export function ApiPanel() {
  const { copiedKey, copy } = useCopy()
  const [curlCopied, setCurlCopied] = React.useState<string | null>(null)
  const [activeEndpoint, setActiveEndpoint] = React.useState<Endpoint>(ENDPOINTS[0]!)
  const [collapsed, setCollapsed] = React.useState<Set<Endpoint['resource']>>(
    new Set(),
  )

  const onCopyPath = (path: string) => copy(`path:${path}`, path)
  const onCopyCurl = (text: string) => {
    void copy('curl', text)
    setCurlCopied(text)
    setTimeout(() => setCurlCopied(null), 1500)
  }

  const toggleResource = (r: Endpoint['resource']) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(r)) next.delete(r)
      else next.add(r)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Developer API" />
      <ScrollArea className="flex-1 max-h-[calc(100vh-7rem)]">
        <div className="flex flex-col gap-2">
          <ApiKeyField />
        </div>

        <SectionTitle>Endpoints by resource</SectionTitle>
        <div className="flex flex-col gap-2 px-4 pb-4">
          {RESOURCE_ORDER.map((resource) => {
            const eps = ENDPOINTS.filter((e) => e.resource === resource)
            if (eps.length === 0) return null
            const isCollapsed = collapsed.has(resource)
            const meta = RESOURCE_LABELS[resource]
            return (
              <div
                key={resource}
                className="rounded-md border border-border overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleResource(resource)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-accent/40 transition-colors"
                  aria-expanded={!isCollapsed}
                  aria-label={`Toggle ${meta.label} endpoints`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold tracking-tight">
                      {meta.label}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-4 px-1 font-mono"
                    >
                      {eps.length}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                      {meta.description}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'size-3.5 text-muted-foreground transition-transform',
                      isCollapsed && '-rotate-90',
                    )}
                  />
                </button>
                {!isCollapsed && (
                  <div className="flex flex-col gap-1.5 px-2 pb-2 pt-0.5 border-t border-border/60">
                    {eps.map((ep) => (
                      <button
                        key={`${ep.method}-${ep.path}`}
                        type="button"
                        onClick={() => setActiveEndpoint(ep)}
                        className="text-left w-full"
                        aria-label={`Select ${ep.method} ${ep.path}`}
                      >
                        <EndpointRow
                          endpoint={ep}
                          onCopy={onCopyPath}
                          copied={copiedKey === `path:${ep.method}:${ep.path}`}
                          isActive={
                            activeEndpoint.method === ep.method &&
                            activeEndpoint.path === ep.path
                          }
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <SectionTitle>Try it</SectionTitle>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <CurlCard
            endpoint={activeEndpoint}
            onCopy={onCopyCurl}
            copied={curlCopied ===
              `curl -X ${activeEndpoint.method} '${activeEndpoint.path}'`}
          />
          <div className="rounded-md border border-dashed border-border p-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <ArrowRight className="size-3 shrink-0" />
            <span>
              All paths are relative — the gateway rewrites the port as needed.
            </span>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
