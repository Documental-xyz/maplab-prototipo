'use client'

// MapLab Studio — Settings dialog.
// Lets the user configure:
//   - Default basemap for new projects
//   - Theme (light / dark / system) — mirrors the TopBar toggle
//   - Max undo history size (display only for now; the cap is in code)
//   - Clear local cache (localStorage) — removes the persisted session + style
//   - About info

import * as React from 'react'
import {
  Settings as SettingsIcon,
  Trash2,
  Loader2,
  Check,
  Info,
  Palette,
  Map as MapIcon,
  History,
  Database,
} from 'lucide-react'
import { useTheme } from 'next-themes'

import { useMapLabStore } from '@/lib/map-store'
import { clearSWRCache } from '@/lib/use-swr'
import { BASEMAPS } from '@/lib/defaults'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

function SettingRow({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: React.ElementType
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="size-7 rounded-md bg-muted grid place-items-center shrink-0">
          <Icon className="size-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          {description && (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {description}
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const basemapId = useMapLabStore((s) => s.basemapId)
  const setBasemap = useMapLabStore((s) => s.setBasemap)
  const pushToast = useMapLabStore((s) => s.pushToast)
  const clearHistory = useMapLabStore((s) => s.clearHistory)
  const canUndo = useMapLabStore((s) => s.canUndo)
  const canRedo = useMapLabStore((s) => s.canRedo)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const [clearing, setClearing] = React.useState(false)

  const handleClearCache = async () => {
    setClearing(true)
    try {
      // Remove both localStorage keys + clear the SWR cache + reload so the
      // store re-initialises from defaults.
      window.localStorage.removeItem('maplab:session:v1')
      window.localStorage.removeItem('maplab:style:v1')
      clearSWRCache()
      pushToast('Local cache cleared', 'success')
      onOpenChange(false)
      // Small delay so the toast renders before reload.
      setTimeout(() => window.location.reload(), 400)
    } catch (e) {
      pushToast(
        `Clear failed: ${e instanceof Error ? e.message : String(e)}`,
        'error',
      )
      setClearing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="size-4" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure MapLab Studio. Settings are stored locally.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col divide-y">
          {/* Theme */}
          <SettingRow
            icon={Palette}
            label="Theme"
            description="Light, dark, or follow the system."
          >
            <Select
              value={mounted ? theme ?? 'system' : 'system'}
              onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}
            >
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          {/* Default basemap */}
          <SettingRow
            icon={MapIcon}
            label="Basemap"
            description="The base map rendered under your layers."
          >
            <Select value={basemapId} onValueChange={setBasemap}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASEMAPS.map((bm) => (
                  <SelectItem key={bm.id} value={bm.id}>
                    {bm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          {/* Undo/redo */}
          <SettingRow
            icon={History}
            label="Undo history"
            description="Up to 50 style snapshots are kept in memory."
          >
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={!canUndo}
                    onClick={() => {
                      useMapLabStore.getState().undo()
                    }}
                  >
                    Undo
                  </Button>
                </TooltipTrigger>
                <TooltipContent>⌘Z</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={!canRedo}
                    onClick={() => {
                      useMapLabStore.getState().redo()
                    }}
                  >
                    Redo
                  </Button>
                </TooltipTrigger>
                <TooltipContent>⌘⇧Z</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[11px]"
                disabled={!canUndo && !canRedo}
                onClick={() => {
                  clearHistory()
                  pushToast('History cleared', 'info')
                }}
              >
                Clear
              </Button>
            </div>
          </SettingRow>

          {/* Local cache */}
          <SettingRow
            icon={Database}
            label="Local cache"
            description="Clears the persisted session + style from localStorage."
          >
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-destructive hover:text-destructive"
              disabled={clearing}
              onClick={handleClearCache}
            >
              {clearing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Clear cache
            </Button>
          </SettingRow>

          {/* About */}
          <SettingRow
            icon={Info}
            label="About"
            description="MapLab Studio — open-source Mapbox Studio alternative."
          >
            <Badge variant="secondary" className="text-[10px]">
              v0.2
            </Badge>
          </SettingRow>
        </div>

        <Separator />

        <div className="rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          <div className="font-medium mb-1">Keyboard shortcuts</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
            <span>⌘K / ?</span>
            <span>Command palette</span>
            <span>⌘Z</span>
            <span>Undo</span>
            <span>⌘⇧Z / ⌘Y</span>
            <span>Redo</span>
            <span>⌘D</span>
            <span>Duplicate layer</span>
            <span>L</span>
            <span>Focus layer filter</span>
            <span>↑ / ↓</span>
            <span>Move layer selection</span>
            <span>Delete</span>
            <span>Remove selected layer</span>
            <span>V</span>
            <span>Toggle layer visibility</span>
            <span>F2</span>
            <span>Rename selected layer</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SettingsDialog
