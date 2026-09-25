'use client'

// MapLab Studio — main IDE shell.
// Layout (desktop):
//   ┌───────────────────────────────────────────────────────────────┐
//   │                          TopBar                                │
//   ├──┬───────────────────────┬─────────────────────────┬─────────┤
//   │  │  Active panel          │                         │  Layer  │
//   │S │  (layers/data/maps/…)  │        MapLibre         │  editor │
//   │i │                        │         Map             │         │
//   │d │                        │                         │         │
//   │e │                        │                         │         │
//   ├──┴───────────────────────┴─────────────────────────┴─────────┤
//   │                  Status bar (zoom / coords / FPS)              │
//   └───────────────────────────────────────────────────────────────┘
//
// Mobile: top bar stays, sidebar collapses to a Sheet trigger,
// panel content + right editor become Sheet overlays.

import * as React from 'react'
import {
  PanelLeft,
  PanelRight,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  RotateCcw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { TopBar } from '@/components/top-bar'
import { Sidebar, SidebarHeader, PANEL_LABELS } from '@/components/panels/sidebar'
import { MapsPanel } from '@/components/panels/maps-panel'
import { DataPanel } from '@/components/panels/data-panel'
import { StylesPanel } from '@/components/panels/styles-panel'
import { TilesPanel } from '@/components/panels/tiles-panel'
import { SearchPanel } from '@/components/panels/search-panel'
import { RoutingPanel } from '@/components/panels/routing-panel'
import { ApiPanel } from '@/components/panels/api-panel'
import { LayersPanel } from '@/components/panels/layers-panel'
import { LayerEditor } from '@/components/panels/layer-editor'
import { Inspector } from '@/components/panels/inspector'
import { PublishDialog } from '@/components/publish-dialog'
import { ImportDialog } from '@/components/import-dialog'
import { ShareDialog } from '@/components/share-dialog'
import { CommandPalette } from '@/components/command-palette'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { MapView } from '@/components/map/map-view'
import { DrawControl } from '@/components/map/draw-control'
import { MapControls } from '@/components/map/map-controls'
import { MapAttribution } from '@/components/map/map-attribution'

import { useMapLabStore } from '@/lib/map-store'
import { BASEMAPS } from '@/lib/defaults'
import { useIsMobile } from '@/hooks/use-mobile'

function ActivePanelContent() {
  const activePanel = useMapLabStore((s) => s.activePanel)
  switch (activePanel) {
    case 'maps':
      return <MapsPanel />
    case 'data':
      return <DataPanel />
    case 'styles':
      return <StylesPanel />
    case 'tiles':
      return <TilesPanel />
    case 'search':
      return <SearchPanel />
    case 'routing':
      return <RoutingPanel />
    case 'api':
      return <ApiPanel />
    case 'layers':
      return <LayersPanel />
    case 'inspector':
      return <Inspector />
    default:
      return null
  }
}

function LeftPanel() {
  const activePanel = useMapLabStore((s) => s.activePanel)
  return (
    <div className="flex h-full flex-col bg-background">
      <SidebarHeader />
      <Separator />
      <div className="min-h-0 flex-1">
        <ActivePanelContent />
      </div>
    </div>
  )
}

function StatusBar() {
  const view = useMapLabStore((s) => s.view)
  const layers = useMapLabStore((s) => s.mapStyle.layers)
  const basemapId = useMapLabStore((s) => s.basemapId)
  const fitToData = useMapLabStore((s) => s.fitToData)
  const resetView = useMapLabStore((s) => s.resetView)
  const visibleCount = layers.filter((l) => l.visible).length
  const basemapName = React.useMemo(() => {
    const bm = BASEMAPS.find((b) => b.id === basemapId)
    return bm?.name ?? basemapId
  }, [basemapId])
  const [fmt, setFmt] = React.useState({ lat: '0.00', lng: '0.00', zoom: '0.0' })
  React.useEffect(() => {
    const lng = view.center[0]
    const lat = view.center[1]
    setFmt({
      lat: lat >= 0 ? `N ${lat.toFixed(4)}°` : `S ${(-lat).toFixed(4)}°`,
      lng: lng >= 0 ? `E ${lng.toFixed(4)}°` : `W ${(-lng).toFixed(4)}°`,
      zoom: view.zoom.toFixed(1),
    })
  }, [view])
  return (
    <footer className="z-30 flex h-7 items-center justify-between border-t bg-background px-3 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono">{fmt.lat}</span>
        <span className="font-mono hidden sm:inline">{fmt.lng}</span>
        <Separator orientation="vertical" className="h-3" />
        <span>z {fmt.zoom}</span>
        <Separator orientation="vertical" className="h-3 hidden sm:block" />
        <span className="hidden sm:inline truncate max-w-32" title={basemapName}>
          {basemapName}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={fitToData}
              className="hidden md:inline-flex items-center gap-1 hover:text-foreground transition-colors"
              aria-label="Fit map to data"
            >
              <Crosshair className="size-3" />
              <span>Fit</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Fit map to all GeoJSON data</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-3 hidden md:block" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={resetView}
              className="hidden md:inline-flex items-center gap-1 hover:text-foreground transition-colors"
              aria-label="Reset view"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Reset camera to style default view
          </TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-3 hidden md:block" />
        <span>{visibleCount}/{layers.length} layers</span>
        <Separator orientation="vertical" className="h-3" />
        <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">
          MapLibre GL
        </Badge>
        <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal hidden sm:inline-flex">
          PMTiles
        </Badge>
      </div>
    </footer>
  )
}

// Mobile overlay for the left panel — triggered from the sidebar rail.
function MobilePanelSheet() {
  const isMobile = useIsMobile()
  const open = useMapLabStore((s) => s.mobilePanelOpen)
  const setOpen = useMapLabStore((s) => s.setMobilePanelOpen)
  const activePanel = useMapLabStore((s) => s.activePanel)
  if (!isMobile) return null
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>{PANEL_LABELS[activePanel]}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          <LeftPanel />
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Mobile overlay for the right editor panel.
function MobileEditorSheet() {
  const isMobile = useIsMobile()
  const open = useMapLabStore((s) => s.mobileEditorOpen)
  const setOpen = useMapLabStore((s) => s.setMobileEditorOpen)
  if (!isMobile) return null
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-[88vw] max-w-md p-0">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>Layer editor</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          <LayerEditor />
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Mobile floating buttons to open the panels.
function MobileFabs() {
  const isMobile = useIsMobile()
  const setMobilePanelOpen = useMapLabStore((s) => s.setMobilePanelOpen)
  const setMobileEditorOpen = useMapLabStore((s) => s.setMobileEditorOpen)
  const rightPanelOpen = useMapLabStore((s) => s.rightPanelOpen)
  if (!isMobile) return null
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-3 top-3 z-30 h-9 w-9 rounded-full bg-background/90 shadow-md backdrop-blur"
            onClick={() => setMobilePanelOpen(true)}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Open panel</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={rightPanelOpen ? 'default' : 'outline'}
            size="icon"
            className="absolute right-3 top-3 z-30 h-9 w-9 rounded-full bg-background/90 shadow-md backdrop-blur"
            onClick={() => setMobileEditorOpen(true)}
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Layer editor</TooltipContent>
      </Tooltip>
    </>
  )
}

export default function Home() {
  const isMobile = useIsMobile()
  const rightPanelOpen = useMapLabStore((s) => s.rightPanelOpen)
  const setRightPanelOpen = useMapLabStore((s) => s.setRightPanel)
  const sidebarCollapsed = useMapLabStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useMapLabStore((s) => s.toggleSidebar)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <TopBar />

      <div className="relative flex min-h-0 flex-1">
        {/* Desktop three-pane layout */}
        {!isMobile && (
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            {/* Left: sidebar rail + active panel */}
            <ResizablePanel defaultSize={24} minSize={18} maxSize={36}>
              <div className="flex h-full">
                <div className="flex flex-col items-center border-r bg-muted/30">
                  <Sidebar />
                </div>
                <div className="min-w-0 flex-1">
                  <LeftPanel />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Center: map */}
            <ResizablePanel defaultSize={48} minSize={30}>
              <div className="relative h-full w-full">
                <MapView>
                  <DrawControl />
                  <MapControls />
                  <MapAttribution />
                </MapView>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right: layer editor */}
            <ResizablePanel
              defaultSize={28}
              minSize={18}
              maxSize={42}
              className={rightPanelOpen ? '' : 'hidden'}
            >
              <div className="flex h-full flex-col bg-background">
                <div className="flex h-10 items-center justify-between border-b px-3">
                  <span className="text-sm font-semibold tracking-tight">
                    Layer editor
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setRightPanelOpen(false)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Hide panel</TooltipContent>
                  </Tooltip>
                </div>
                <div className="min-h-0 flex-1">
                  <LayerEditor />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}

        {/* Collapsed-right-panel restore button (desktop) */}
        {!isMobile && !rightPanelOpen && (
          <div className="flex w-10 flex-col items-center border-l bg-muted/30 py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setRightPanelOpen(true)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Show editor</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Mobile: full-screen map + floating buttons */}
        {isMobile && (
          <div className="relative h-full w-full">
            <MapView>
              <DrawControl />
              <MapControls />
              <MapAttribution />
            </MapView>
            <MobileFabs />
          </div>
        )}

        <MobilePanelSheet />
        <MobileEditorSheet />
      </div>

      <StatusBar />

      {/* Global modals */}
      <PublishDialog />
      <ImportDialog />
      <ShareDialog />
      <CommandPalette />
      <KeyboardShortcuts />

      {/* Sidebar collapse toggle (desktop, tiny strip between sidebar and content) */}
      {!isMobile && (
        <button
          aria-label="Toggle sidebar"
          onClick={toggleSidebar}
          className="fixed bottom-9 left-2 z-40 hidden h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground md:flex"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  )
}
