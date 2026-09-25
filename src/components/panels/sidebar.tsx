'use client'

// MapLab Studio — left icon rail + panel header.
// The rail is fixed-width on desktop (collapsible) and a horizontal strip
// at the top of the panel area on mobile.

import * as React from 'react'
import {
  Map as MapIcon,
  Database,
  Palette,
  Layers3,
  Search,
  Navigation,
  Code,
  ListTree,
  MousePointer2,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useMapLabStore } from '@/lib/map-store'
import type { PanelId } from '@/lib/types'
import { useIsMobile } from '@/hooks/use-mobile'

interface PanelItem {
  id: PanelId
  label: string
  icon: React.ElementType
}

const PANEL_ITEMS: PanelItem[] = [
  { id: 'maps', label: 'Maps', icon: MapIcon },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'styles', label: 'Styles', icon: Palette },
  { id: 'tiles', label: 'Tiles', icon: Layers3 },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'routing', label: 'Routing', icon: Navigation },
  { id: 'api', label: 'API', icon: Code },
  { id: 'layers', label: 'Layers', icon: ListTree },
  { id: 'inspector', label: 'Inspector', icon: MousePointer2 },
]

export const PANEL_LABELS: Record<PanelId, string> = {
  maps: 'Maps',
  data: 'Datasets',
  styles: 'Styles',
  tiles: 'Tile Sources',
  search: 'Place Search',
  routing: 'Routing',
  api: 'Developer API',
  layers: 'Layers',
  inspector: 'Inspector',
}

function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-md bg-primary text-primary-foreground shrink-0',
        className,
      )}
      aria-hidden="true"
    >
      <MapIcon className="size-[60%]" />
    </div>
  )
}

/**
 * Small header bar that shows the active panel title. The parent renders
 * this directly above the active panel content on desktop, or hidden on
 * mobile (the mobile rail already shows labels).
 */
export function SidebarHeader({ className }: { className?: string }) {
  const activePanel = useMapLabStore((s) => s.activePanel)
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b px-4 py-3',
        className,
      )}
    >
      <span className="text-sm font-semibold tracking-tight">
        {PANEL_LABELS[activePanel]}
      </span>
    </div>
  )
}

interface SidebarRailProps {
  className?: string
}

/**
 * Desktop vertical icon rail. Collapsible via store.toggleSidebar.
 */
function DesktopRail({ className }: SidebarRailProps) {
  const activePanel = useMapLabStore((s) => s.activePanel)
  const setActivePanel = useMapLabStore((s) => s.setActivePanel)
  const collapsed = useMapLabStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useMapLabStore((s) => s.toggleSidebar)

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col items-stretch border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-56',
        className,
      )}
      aria-label="Primary navigation"
    >
      <div className="flex items-center gap-2 border-b px-3 h-14">
        <BrandMark className="size-7" />
        {!collapsed && (
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight">
              MapLab
            </span>
            <span className="text-[10px] text-muted-foreground">
              Studio
            </span>
          </div>
        )}
      </div>

      <nav
        className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto"
        aria-label="Panel navigation"
      >
        {PANEL_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activePanel === id
          const button = (
            <button
              key={id}
              type="button"
              onClick={() => setActivePanel(id)}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 min-h-11 h-11 text-sm font-medium transition-colors',
                collapsed && 'justify-center px-0',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          )

          if (collapsed) {
            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            )
          }
          return button
        })}
      </nav>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-full h-11"
        >
          {collapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <>
              <PanelLeftClose className="size-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}

/**
 * Mobile horizontal scrollable strip of icon+label buttons.
 */
function MobileRail({ className }: SidebarRailProps) {
  const activePanel = useMapLabStore((s) => s.activePanel)
  const setActivePanel = useMapLabStore((s) => s.setActivePanel)

  return (
    <div
      className={cn(
        'md:hidden flex items-stretch gap-1 overflow-x-auto border-b bg-sidebar',
        className,
      )}
      aria-label="Primary navigation"
    >
      <div className="flex items-center px-3 shrink-0">
        <BrandMark className="size-7" />
      </div>
      <div
        className="flex items-center gap-1 px-1 py-2"
        role="tablist"
        aria-orientation="horizontal"
      >
        {PANEL_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activePanel === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActivePanel(id)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 h-10 min-h-11 shrink-0 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-sidebar-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The Sidebar rail — public named export.
 * Renders the desktop vertical rail by default, swaps to a mobile
 * horizontal strip below the md breakpoint.
 */
export function Sidebar({ className }: { className?: string }) {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileRail className={className} />
  return <DesktopRail className={className} />
}

export { PANEL_ITEMS }
