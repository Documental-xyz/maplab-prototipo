'use client'

// MapLab Studio — Keyboard shortcuts dialog.
// A comprehensive reference of all keyboard shortcuts, accessible from the
// TopBar's "More" menu → "Keyboard shortcuts" or by pressing `?` (when no
// input is focused).

import * as React from 'react'
import { Keyboard, CornerDownLeft } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

interface Shortcut {
  keys: string
  description: string
  category: 'Global' | 'Editing' | 'Layers' | 'Navigation'
}

const SHORTCUTS: Shortcut[] = [
  // Global
  { keys: '⌘K / ?', description: 'Open command palette', category: 'Global' },
  { keys: '⌘Z', description: 'Undo last edit', category: 'Global' },
  { keys: '⌘⇧Z / ⌘Y', description: 'Redo', category: 'Global' },
  { keys: '⌘D', description: 'Duplicate selected layer', category: 'Global' },
  { keys: '⌘⇧↑ / ⌘⇧↓', description: 'Move layer up/down in render order', category: 'Global' },
  // Layers
  { keys: 'L', description: 'Focus the layer filter input', category: 'Layers' },
  { keys: '↑ / ↓', description: 'Move layer selection up/down', category: 'Layers' },
  { keys: 'Delete', description: 'Remove the selected layer', category: 'Layers' },
  { keys: 'V', description: 'Toggle the selected layer visibility', category: 'Layers' },
  { keys: 'F2', description: 'Rename the selected layer', category: 'Layers' },
  // Editing
  { keys: 'Double-click', description: 'Rename a layer inline (in the Layers panel)', category: 'Editing' },
  { keys: 'Drag', description: 'Reorder layers (drag the handle in the Layers panel)', category: 'Editing' },
  // Navigation
  { keys: 'Fit', description: 'Fit the map to all GeoJSON data (status bar button)', category: 'Navigation' },
  { keys: 'Reset', description: 'Reset the camera to the style default view (status bar button)', category: 'Navigation' },
  { keys: 'Esc', description: 'Close dialogs / clear draw mode', category: 'Navigation' },
]

const CATEGORY_ORDER: Shortcut['category'][] = ['Global', 'Layers', 'Editing', 'Navigation']
const CATEGORY_COLORS: Record<Shortcut['category'], string> = {
  Global: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  Layers: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  Editing: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  Navigation: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
}

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-4" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            All keyboard shortcuts in MapLab Studio.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
          {CATEGORY_ORDER.map((cat) => {
            const items = SHORTCUTS.filter((s) => s.category === cat)
            if (items.length === 0) return null
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 ${CATEGORY_COLORS[cat]}`}
                  >
                    {cat}
                  </Badge>
                </div>
                <div className="flex flex-col gap-1">
                  {items.map((s, i) => (
                    <div
                      key={`${s.keys}-${i}`}
                      className="flex items-center justify-between gap-3 text-xs py-1"
                    >
                      <span className="text-muted-foreground">
                        {s.description}
                      </span>
                      <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded border bg-muted/50 whitespace-nowrap">
                        {s.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <CornerDownLeft className="size-3" />
          <span>
            Tip: press <kbd className="font-mono">?</kbd> anywhere (when not
            typing in an input) to open the command palette.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
