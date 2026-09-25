'use client'

// MapLab Studio — Command palette.
// Opens with Cmd/Ctrl+K or `?`. Lets the user search and switch:
//   - Panels (Maps, Data, Styles, Tiles, Search, Routing, API, Layers, Inspector)
//   - Layers in the current style
//   - Basemaps
//   - Actions (Save, Publish, Import, Share, New style, Fit to data, Reset view)
//
// Built on top of the shadcn `command.tsx` (cmdk) primitives.

import * as React from 'react'
import {
  Map as MapIcon,
  Database,
  Palette,
  Layers3,
  Search as SearchIcon,
  Navigation,
  Code,
  ListTree,
  MousePointer2,
  Save,
  Upload,
  Share2,
  Plus,
  Crosshair,
  RotateCcw,
  Sparkles,
  CornerDownLeft,
  Undo2,
  Redo2,
  Folder as FolderIcon,
} from 'lucide-react'

import { useMapLabStore } from '@/lib/map-store'
import { useSaveProject } from '@/lib/use-save-project'
import { useSWR } from '@/lib/use-swr'
import { BASEMAPS } from '@/lib/defaults'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import type { PanelId } from '@/lib/types'

interface PaletteAction {
  id: string
  label: string
  onSelect: () => void
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
}

const PANEL_ITEMS: { id: PanelId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'maps', label: 'Maps', icon: MapIcon },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'styles', label: 'Styles', icon: Palette },
  { id: 'tiles', label: 'Tiles', icon: Layers3 },
  { id: 'search', label: 'Search', icon: SearchIcon },
  { id: 'routing', label: 'Routing', icon: Navigation },
  { id: 'api', label: 'API', icon: Code },
  { id: 'layers', label: 'Layers', icon: ListTree },
  { id: 'inspector', label: 'Inspector', icon: MousePointer2 },
]

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)

  // Subscribe to store fields we need for the actions.
  const setActivePanel = useMapLabStore((s) => s.setActivePanel)
  const selectLayer = useMapLabStore((s) => s.selectLayer)
  const setBasemap = useMapLabStore((s) => s.setBasemap)
  const layers = useMapLabStore((s) => s.mapStyle.layers)
  const setPublishOpen = useMapLabStore((s) => s.setPublishOpen)
  const setImportOpen = useMapLabStore((s) => s.setImportOpen)
  const setShareOpen = useMapLabStore((s) => s.setShareOpen)
  const newStyle = useMapLabStore((s) => s.newStyle)
  const fitToData = useMapLabStore((s) => s.fitToData)
  const resetView = useMapLabStore((s) => s.resetView)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const { save: saveProject } = useSaveProject()

  // Fetch the recent projects list via SWR — the cache means rapid
  // open/close doesn't re-fetch (data is served from cache immediately,
  // then revalidated in the background if older than 5 minutes).
  const { data: projectsData } = useSWR<{ projects?: Array<{ id: string; name: string }> }>(
    '/api/projects',
  )
  const recentProjects = projectsData?.projects ?? []
  const project = useMapLabStore((s) => s.project)
  const loadProject = useMapLabStore((s) => s.loadProject)

  // Cmd/Ctrl+K or `?` to open, Esc to close (cmdk handles Esc itself).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K — always opens.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      // `?` (Shift+/) — only when no input is focused, to avoid hijacking
      // typing. Same guard as the `L` shortcut in the Layers panel.
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target as HTMLElement | null
        const tag = t?.tagName ?? ''
        const isEditable =
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          t?.isContentEditable === true
        if (isEditable) return
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Build the action list. These run inside cmdk's onSelect.
  const actions: PaletteAction[] = React.useMemo(
    () => [
      {
        id: 'save',
        label: 'Save project',
        icon: Save,
        onSelect: () => {
          void saveProject()
          setOpen(false)
        },
      },
      {
        id: 'publish',
        label: 'Publish project',
        icon: Sparkles,
        onSelect: () => {
          setPublishOpen(true)
          setOpen(false)
        },
      },
      {
        id: 'import',
        label: 'Import data',
        icon: Upload,
        onSelect: () => {
          setImportOpen(true)
          setOpen(false)
        },
      },
      {
        id: 'share',
        label: 'Share project',
        icon: Share2,
        onSelect: () => {
          setShareOpen(true)
          setOpen(false)
        },
      },
      {
        id: 'new-style',
        label: 'New style',
        icon: Plus,
        onSelect: () => {
          newStyle()
          pushToast('New style created', 'success')
          setOpen(false)
        },
      },
      {
        id: 'fit-data',
        label: 'Fit map to data',
        icon: Crosshair,
        onSelect: () => {
          fitToData()
          setOpen(false)
        },
      },
      {
        id: 'reset-view',
        label: 'Reset camera to default view',
        icon: RotateCcw,
        onSelect: () => {
          resetView()
          setOpen(false)
        },
      },
      {
        id: 'undo',
        label: 'Undo last edit',
        icon: Undo2,
        onSelect: () => {
          useMapLabStore.getState().undo()
          setOpen(false)
        },
      },
      {
        id: 'redo',
        label: 'Redo',
        icon: Redo2,
        onSelect: () => {
          useMapLabStore.getState().redo()
          setOpen(false)
        },
      },
    ],
    [fitToData, newStyle, pushToast, resetView, saveProject, setImportOpen, setPublishOpen, setShareOpen],
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="MapLab command palette"
      description="Search panels, layers, basemaps and actions."
    >
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Panels">
          {PANEL_ITEMS.map((p) => (
            <CommandItem
              key={p.id}
              value={`panel ${p.label}`}
              onSelect={() => {
                setActivePanel(p.id)
                setOpen(false)
              }}
            >
              <p.icon className="size-4" />
              <span>{p.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Layers">
          {layers.map((l) => (
            <CommandItem
              key={l.id}
              value={`layer ${l.name} ${l.type}`}
              onSelect={() => {
                selectLayer(l.id)
                setActivePanel('layers')
                setOpen(false)
              }}
            >
              <ListTree className="size-4" />
              <span className="truncate">{l.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {l.type}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Basemaps">
          {BASEMAPS.map((bm) => (
            <CommandItem
              key={bm.id}
              value={`basemap ${bm.name} ${bm.category}`}
              onSelect={() => {
                setBasemap(bm.id)
                pushToast(`Basemap: ${bm.name}`, 'info')
                setOpen(false)
              }}
            >
              <MapIcon className="size-4" />
              <span>{bm.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {bm.category}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {recentProjects.length > 0 && (
          <>
            <CommandGroup heading="Recent projects">
              {recentProjects.slice(0, 6).map((p) => {
                const isActive = p.id === project.id
                return (
                  <CommandItem
                    key={p.id}
                    value={`project ${p.name}`}
                    disabled={isActive}
                    onSelect={() => {
                      void loadProject({
                        id: p.id,
                        name: p.name,
                        description: '',
                      })
                      setOpen(false)
                    }}
                  >
                    <FolderIcon className="size-4" />
                    <span className="truncate">{p.name}</span>
                    {isActive && (
                      <Badge variant="default" className="ml-auto text-[9px] h-4 px-1">
                        active
                      </Badge>
                    )}
                    {!isActive && (
                      <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                        {p.id.slice(0, 8)}…
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Actions">
          {actions.map((a) => (
            <CommandItem
              key={a.id}
              value={`action ${a.label}`}
              onSelect={() => {
                a.onSelect()
              }}
            >
              <a.icon className="size-4" />
              <span>{a.label}</span>
              {a.shortcut && (
                <CommandShortcut>{a.shortcut}</CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Tips">
          <CommandItem
            value="help shortcuts"
            onSelect={() => {
              pushToast(
                'Shortcuts: ⌘K / ? = palette · L = layer filter · Esc = close',
                'info',
              )
              setOpen(false)
            }}
          >
            <CornerDownLeft className="size-4" />
            <span>Keyboard shortcuts help</span>
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
