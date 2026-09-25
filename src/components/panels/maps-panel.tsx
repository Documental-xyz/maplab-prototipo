'use client'

// MapLab Studio — "Maps" panel.
// Project metadata editor + basemap picker + recent projects list + project
// actions.

import * as React from 'react'
import {
  Save,
  Sparkles,
  Upload,
  Share2,
  Globe2,
  Check,
  History,
  RefreshCw,
  AlertCircle,
  Trash2,
  Loader2,
  FolderOpen,
} from 'lucide-react'
import { useMapLabStore } from '@/lib/map-store'
import { useSWR } from '@/lib/use-swr'
import { BASEMAPS } from '@/lib/defaults'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { cn } from '@/lib/utils'

interface RecentProject {
  id: string
  name: string
  description: string | null
  updatedAt: string
  // Prisma's `_count` aggregate — see GET /api/projects.
  _count?: { styles: number; datasets: number; tileSources: number }
  // Defensive fallback in case the API shape changes.
  counts?: { styles: number; datasets: number; tileSources: number }
}

function useRecentProjects() {
  const { data, loading, error, reload } = useSWR<{ projects?: RecentProject[] }>(
    '/api/projects',
  )
  return {
    projects: data?.projects ?? [],
    loading,
    error,
    reload: () => void reload(),
  }
}

function projectCounts(p: RecentProject) {
  return p._count ?? p.counts ?? { styles: 0, datasets: 0, tileSources: 0 }
}

function PanelHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <header className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {hint && (
        <span className="text-xs text-muted-foreground truncate">{hint}</span>
      )}
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

function BasemapCard({
  id,
  name,
  preview,
  attribution,
  category,
  selected,
  onSelect,
}: {
  id: string
  name: string
  preview: string
  attribution: string
  category: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Select ${name} basemap`}
      className={cn(
        'group relative flex flex-col gap-1.5 rounded-lg border bg-card p-2 text-left transition-all hover:shadow-md min-h-24',
        selected ? 'ring-2 ring-primary border-primary' : 'border-border',
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-muted">
        {preview ? (
          <img
            src={preview}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Globe2 className="size-6 text-muted-foreground" />
          </div>
        )}
        {selected && (
          <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3" />
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium truncate">{name}</span>
        <Badge variant="outline" className="capitalize text-[10px] px-1 py-0">
          {category}
        </Badge>
      </div>
      <p className="text-[10px] text-muted-foreground truncate">
        {attribution}
      </p>
    </button>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'outline',
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
}) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      className="h-11 min-h-11 w-full justify-start"
    >
      <Icon className="size-4" />
      <span className="truncate">{label}</span>
    </Button>
  )
}

export function MapsPanel() {
  const project = useMapLabStore((s) => s.project)
  const setProject = useMapLabStore((s) => s.setProject)
  const loadProject = useMapLabStore((s) => s.loadProject)
  const dirty = useMapLabStore((s) => s.dirty)
  const basemapId = useMapLabStore((s) => s.basemapId)
  const setBasemap = useMapLabStore((s) => s.setBasemap)
  const newStyle = useMapLabStore((s) => s.newStyle)
  const setImportOpen = useMapLabStore((s) => s.setImportOpen)
  const setPublishOpen = useMapLabStore((s) => s.setPublishOpen)
  const setShareOpen = useMapLabStore((s) => s.setShareOpen)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const { projects, loading, error, reload } = useRecentProjects()

  // Per-project "loading" state for the Load button + delete confirmation.
  const [loadingProjectId, setLoadingProjectId] = React.useState<string | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = React.useState<RecentProject | null>(
    null,
  )
  const [deleting, setDeleting] = React.useState(false)

  const [name, setName] = React.useState(project.name)
  const [description, setDescription] = React.useState(project.description)

  // Sync local state when project changes externally (e.g. loaded).
  React.useEffect(() => {
    setName(project.name)
    setDescription(project.description)
  }, [project.id, project.name, project.description])

  const commitName = React.useCallback(
    (val: string) => {
      setProject({ name: val })
      pushToast('Project renamed', 'info')
    },
    [setProject, pushToast],
  )

  const commitDescription = React.useCallback(
    (val: string) => {
      setProject({ description: val })
    },
    [setProject],
  )

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Project" />
      <ScrollArea className="flex-1 max-h-[calc(100vh-7rem)]">
        <div className="flex flex-col gap-2 px-4 pb-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={(e) => commitName(e.target.value)}
              placeholder="Untitled Project"
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-desc">Description</Label>
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={(e) => commitDescription(e.target.value)}
              placeholder="Add a short description…"
              className="min-h-20"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={dirty ? 'default' : 'secondary'}>
              {dirty ? 'Unsaved' : 'Saved'}
            </Badge>
            <span className="truncate">ID: {project.id}</span>
          </div>
        </div>

        <Separator />

        <SectionTitle>Base map</SectionTitle>
        <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-3">
          {BASEMAPS.map((bm) => (
            <BasemapCard
              key={bm.id}
              id={bm.id}
              name={bm.name}
              preview={bm.preview}
              attribution={bm.attribution}
              category={bm.category}
              selected={basemapId === bm.id}
              onSelect={() => {
                setBasemap(bm.id)
                pushToast(`Basemap: ${bm.name}`, 'info')
              }}
            />
          ))}
        </div>

        <Separator />

        <SectionTitle>Recent projects</SectionTitle>
        <div className="px-4 pb-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {loading
                ? 'Loading…'
                : error
                  ? 'Failed to load'
                  : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => void reload()}
                  aria-label="Refresh projects"
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
          ) : projects.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic px-1 py-2">
              No saved projects yet. Click "Save" in the top bar to persist the
              current project.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {projects.slice(0, 6).map((p) => {
                const isActive = p.id === project.id
                const isLoading = loadingProjectId === p.id
                return (
                  <div
                    key={p.id}
                    className={cn(
                      'rounded-md border px-2 py-1.5 text-xs transition-colors',
                      isActive
                        ? 'border-primary bg-accent'
                        : 'hover:bg-accent/50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{p.name}</span>
                      {isActive ? (
                        <Badge variant="default" className="text-[9px] h-4 px-1">
                          <Check className="size-2.5 mr-0.5" />
                          active
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(p.updatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono">{p.id.slice(0, 12)}…</span>
                      <span>·</span>
                      <span>{projectCounts(p).styles} styles</span>
                      <span>·</span>
                      <span>{projectCounts(p).datasets} data</span>
                    </div>
                    {!isActive && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] flex-1"
                          disabled={isLoading}
                          onClick={async () => {
                            setLoadingProjectId(p.id)
                            try {
                              await loadProject({
                                id: p.id,
                                name: p.name,
                                description: p.description ?? '',
                              })
                              void reload()
                            } finally {
                              setLoadingProjectId(null)
                            }
                          }}
                        >
                          {isLoading ? (
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
                              className="size-6 text-destructive hover:text-destructive"
                              disabled={isLoading}
                              onClick={() => setDeleteTarget(p)}
                              aria-label={`Delete project ${p.name}`}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete project</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete project?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes <strong>{deleteTarget?.name}</strong> and
                all of its saved styles, datasets, and tile sources. This action
                cannot be undone.
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
                    const res = await fetch(`/api/projects/${deleteTarget.id}`, {
                      method: 'DELETE',
                    })
                    if (!res.ok) {
                      throw new Error(`HTTP ${res.status}`)
                    }
                    pushToast(`Deleted "${deleteTarget.name}"`, 'success')
                    setDeleteTarget(null)
                    void reload()
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

        <Separator />

        <SectionTitle>Project actions</SectionTitle>
        <div className="flex flex-col gap-2 px-4">
          <ActionButton
            icon={Sparkles}
            label="New style"
            onClick={() => {
              newStyle()
              pushToast('New style created', 'success')
            }}
            variant="default"
          />
          <ActionButton
            icon={Upload}
            label="Import data"
            onClick={() => setImportOpen(true)}
          />
          <ActionButton
            icon={Save}
            label="Publish"
            onClick={() => setPublishOpen(true)}
          />
          <ActionButton
            icon={Share2}
            label="Share"
            onClick={() => setShareOpen(true)}
          />
        </div>
      </ScrollArea>
    </div>
  )
}
