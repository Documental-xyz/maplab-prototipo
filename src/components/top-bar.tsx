'use client'

// MapLab Studio — top app bar.
// Sticky, full width, ~48px tall. Holds the brand + project name on the left,
// the draw tool segmented control in the centre, and Save / Import / Publish
// plus a "more" menu on the right. Collapses to a Sheet on mobile.

import * as React from 'react'
import {
  Map as MapIcon,
  MousePointer2,
  Hexagon,
  Minus,
  Circle,
  Trash2,
  Save,
  Upload,
  Share2,
  MoreHorizontal,
  Plus,
  Copy,
  Settings,
  Info,
  ChevronDown,
  Undo2,
  Redo2,
  Loader2,
  Keyboard,
} from 'lucide-react'

import { useMapLabStore } from '@/lib/map-store'
import { useSaveProject } from '@/lib/use-save-project'
import type { DrawMode } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/theme-toggle'
import { SettingsDialog } from '@/components/settings-dialog'
import { ShortcutsDialog } from '@/components/shortcuts-dialog'

interface ToolDef {
  id: DrawMode
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const TOOLS: ToolDef[] = [
  { id: 'simple_select', label: 'Select', icon: MousePointer2 },
  { id: 'draw_polygon', label: 'Polygon', icon: Hexagon },
  { id: 'draw_line_string', label: 'Line', icon: Minus },
  { id: 'draw_point', label: 'Point', icon: Circle },
]

// Undo/Redo button pair — reads the store's canUndo/canRedo flags and calls
// undo()/redo(). Rendered in the TopBar's center toolbar.
function UndoRedoButtons() {
  const undo = useMapLabStore((s) => s.undo)
  const redo = useMapLabStore((s) => s.redo)
  const canUndo = useMapLabStore((s) => s.canUndo)
  const canRedo = useMapLabStore((s) => s.canRedo)
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Undo"
            onClick={undo}
            disabled={!canUndo}
            className="h-8 w-8 rounded-md disabled:opacity-40"
          >
            <Undo2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Undo (⌘Z)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Redo"
            onClick={redo}
            disabled={!canRedo}
            className="h-8 w-8 rounded-md disabled:opacity-40"
          >
            <Redo2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Redo (⌘⇧Z)</TooltipContent>
      </Tooltip>
    </>
  )
}

export function TopBar() {
  const project = useMapLabStore((s) => s.project)
  const setProject = useMapLabStore((s) => s.setProject)
  const dirty = useMapLabStore((s) => s.dirty)
  const drawMode = useMapLabStore((s) => s.drawMode)
  const setDrawMode = useMapLabStore((s) => s.setDrawMode)
  const setImportOpen = useMapLabStore((s) => s.setImportOpen)
  const setPublishOpen = useMapLabStore((s) => s.setPublishOpen)
  const setShareOpen = useMapLabStore((s) => s.setShareOpen)
  const newStyle = useMapLabStore((s) => s.newStyle)
  const duplicateLayer = useMapLabStore((s) => s.duplicateLayer)
  const selectedLayerId = useMapLabStore((s) => s.selectedLayerId)
  const pushToast = useMapLabStore((s) => s.pushToast)

  const [nameDraft, setNameDraft] = React.useState(project.name)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)

  // keep the draft in sync when the project name changes externally
  React.useEffect(() => {
    setNameDraft(project.name)
  }, [project.name])

  const commitName = React.useCallback(() => {
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== project.name) {
      setProject({ name: trimmed })
    } else {
      setNameDraft(project.name)
    }
  }, [nameDraft, project.name, setProject])

  const { save: saveProject, saving: saveInProgress } = useSaveProject()
  const handleSave = React.useCallback(() => {
    void saveProject()
  }, [saveProject])

  const handleNewProject = React.useCallback(() => {
    newStyle()
    setProject({ name: 'Untitled Project', description: '' })
    pushToast('Started a new project', 'info')
  }, [newStyle, setProject, pushToast])

  // Duplicate the entire current project: POST a new project with the same
  // name + description, then save the current style under the new project.
  // On success, switch the store to the new project so subsequent edits land
  // in the duplicate.
  const handleDuplicateProject = React.useCallback(async () => {
    const mapStyle = useMapLabStore.getState().mapStyle
    const proj = useMapLabStore.getState().project
    try {
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${proj.name} (copy)`,
          description: proj.description,
        }),
      })
      if (!createRes.ok)
        throw new Error(`POST /api/projects failed: ${createRes.status}`)
      const created = (await createRes.json()) as
        | { project?: { id: string } }
        | { id: string }
      const newProjectId =
        ('project' in created && created.project?.id) ||
        ('id' in created && created.id) ||
        ''
      if (!newProjectId) throw new Error('Server returned no project id')
      const styleRes = await fetch(`/api/projects/${newProjectId}/styles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: mapStyle.name, spec: mapStyle }),
      })
      if (!styleRes.ok)
        throw new Error(`POST styles failed: ${styleRes.status}`)
      setProject({ id: newProjectId, name: `${proj.name} (copy)` })
      pushToast('Project duplicated', 'success')
    } catch (e) {
      pushToast(
        `Duplicate failed: ${e instanceof Error ? e.message : String(e)}`,
        'error',
      )
    }
  }, [setProject, pushToast])

  const handleDuplicateLayer = React.useCallback(() => {
    if (selectedLayerId) {
      duplicateLayer(selectedLayerId)
      pushToast('Layer duplicated', 'success')
    } else {
      pushToast('No layer selected', 'error')
    }
  }, [selectedLayerId, duplicateLayer, pushToast])

  const renderToolButton = (tool: ToolDef) => {
    const Icon = tool.icon
    const active = drawMode === tool.id
    return (
      <Tooltip key={tool.id}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={tool.label}
            aria-pressed={active}
            onClick={() => setDrawMode(tool.id)}
            className={cn(
              'h-8 w-8 rounded-md',
              active && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
            )}
          >
            <Icon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tool.label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <header className="bg-background border-b sticky top-0 z-40 h-12 flex items-center gap-2 px-2 sm:px-3">
      {/* LEFT: brand + editable project name + dirty dot */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="bg-primary text-primary-foreground size-8 rounded-md grid place-items-center shrink-0">
          <MapIcon className="size-4" />
        </div>
        <div className="relative flex items-center min-w-0">
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              }
              if (e.key === 'Escape') {
                setNameDraft(project.name)
                e.currentTarget.blur()
              }
            }}
            aria-label="Project name"
            className="h-8 w-28 sm:w-40 md:w-56 border-transparent bg-transparent focus-visible:border-input focus-visible:bg-background px-2 text-sm font-medium"
          />
          {dirty ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-2 rounded-full bg-amber-500"
                  aria-hidden="true"
                />
              </TooltipTrigger>
              <TooltipContent side="bottom">Unsaved changes</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      {/* CENTER: draw tools + undo/redo — segmented control */}
      <div className="hidden md:flex items-center gap-1 mx-auto">
        <div className="bg-muted/40 rounded-md flex items-center gap-0.5 p-0.5">
          {TOOLS.map(renderToolButton)}
          <span className="mx-1 h-5 w-px bg-border" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Clear drawing"
                onClick={() => {
                  setDrawMode(null)
                  pushToast('Draw mode cleared', 'info')
                }}
                className="h-8 w-8 rounded-md"
              >
                <Trash2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Clear drawing</TooltipContent>
          </Tooltip>
          <span className="mx-1 h-5 w-px bg-border" />
          <UndoRedoButtons />
        </div>
      </div>

      {/* RIGHT: action buttons */}
      <div className="hidden sm:flex items-center gap-1.5 ml-auto">
        <ThemeToggle />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          disabled={saveInProgress}
          className="h-8"
        >
          {saveInProgress ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          <span className="hidden lg:inline">Save</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setImportOpen(true)}
          className="h-8"
        >
          <Upload className="size-4" />
          <span className="hidden lg:inline">Import</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShareOpen(true)}
          className="h-8"
        >
          <Share2 className="size-4" />
          <span className="hidden xl:inline">Share</span>
        </Button>
        <Button
          size="sm"
          onClick={() => setPublishOpen(true)}
          className="h-8"
        >
          <Plus className="size-4" />
          <span>Publish</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Project</DropdownMenuLabel>
            <DropdownMenuItem onClick={handleNewProject}>
              <Plus className="size-4" />
              New project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicateProject}>
              <Copy className="size-4" />
              Duplicate project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicateLayer}>
              <Copy className="size-4" />
              Duplicate layer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
              <Keyboard className="size-4" />
              Keyboard shortcuts
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => pushToast('MapLab Studio — open-source Mapbox Studio alternative', 'info')}>
              <Info className="size-4" />
              About
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile compact: tool sheet + more menu */}
      <div className="md:hidden ml-auto flex items-center gap-1">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button size="sm" variant="outline" className="h-8">
              <MousePointer2 className="size-4" />
              <span>Tools</span>
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl">
            <SheetHeader>
              <SheetTitle>Draw tools</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-2 p-4 pt-2">
              {TOOLS.map((t) => {
                const Icon = t.icon
                const active = drawMode === t.id
                return (
                  <Button
                    key={t.id}
                    variant={active ? 'default' : 'outline'}
                    onClick={() => {
                      setDrawMode(t.id)
                      setSheetOpen(false)
                    }}
                    className="h-11"
                  >
                    <Icon className="size-4" />
                    {t.label}
                  </Button>
                )
              })}
              <Button
                variant="ghost"
                className="col-span-2 h-11 text-destructive"
                onClick={() => {
                  setDrawMode(null)
                  setSheetOpen(false)
                }}
              >
                <Trash2 className="size-4" />
                Clear drawing
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Project</DropdownMenuLabel>
            <DropdownMenuItem onClick={handleSave}>
              <Save className="size-4" />
              Save
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              Import
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShareOpen(true)}>
              <Share2 className="size-4" />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPublishOpen(true)}>
              <Plus className="size-4" />
              Publish
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleNewProject}>
              <Plus className="size-4" />
              New project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicateProject}>
              <Copy className="size-4" />
              Duplicate project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicateLayer}>
              <Copy className="size-4" />
              Duplicate layer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
              <Keyboard className="size-4" />
              Keyboard shortcuts
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => pushToast('MapLab Studio — open-source Mapbox Studio alternative', 'info')}>
              <Info className="size-4" />
              About
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* tiny status pill — visible on all sizes */}
      <span className="sr-only">
        {dirty ? 'Project has unsaved changes' : 'All changes saved'}
      </span>
      <span className="hidden lg:inline-flex">
        <Badge variant="secondary" className="text-[10px] h-5 font-mono">
          ⌘K
        </Badge>
      </span>
      <span className="hidden xl:inline-flex">
        <Badge variant="secondary" className="text-[10px] h-5">
          v0.1
        </Badge>
      </span>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </header>
  )
}

export default TopBar
