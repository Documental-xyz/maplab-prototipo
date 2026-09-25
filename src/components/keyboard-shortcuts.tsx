'use client'

// MapLab Studio — global keyboard shortcuts hook.
// Wires:
//   - ⌘Z / Ctrl+Z (undo), ⌘⇧Z / Ctrl+Y (redo) to the store's undo/redo actions.
//   - ↑ / ↓ to move the layer selection up/down (only when no input is focused).
//   - Delete / Backspace to remove the selected layer.
//   - V to toggle the selected layer's visibility.
//   - ⌘D / Ctrl+D to duplicate the selected layer.
//   - F2 to rename the selected layer (focuses the Layer name input in the
//     right-panel editor).
//
// Ignores keypresses when an input/textarea/select is focused so the user
// can use the browser's native undo + text editing inside form fields.
//
// Layer navigation shortcuts auto-switch to the Layers panel if it's not
// active, so the user sees the selection move.
//
// Mounted once at the app root (in page.tsx) via the <KeyboardShortcuts />
// component below.

import * as React from 'react'
import { useMapLabStore } from '@/lib/map-store'

function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  const tag = el?.tagName ?? ''
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el?.isContentEditable === true
  )
}

export function useUndoRedoShortcuts() {
  const undo = useMapLabStore((s) => s.undo)
  const redo = useMapLabStore((s) => s.redo)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Only handle Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z (or Ctrl+Y).
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod) return
      const key = e.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return

      if (isEditableTarget(e.target)) return

      e.preventDefault()
      if (key === 'z' && !e.shiftKey) {
        undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])
}

// Layer navigation shortcuts: ↑/↓ to move selection, Delete to remove,
// V to toggle visibility, ⌘D to duplicate, F2 to rename. Active when no input
// is focused. If the Layers panel isn't active, the arrow/Delete/V/F2
// shortcuts auto-switch to it so the user sees the effect.
export function useLayerNavigationShortcuts() {
  const activePanel = useMapLabStore((s) => s.activePanel)
  const layers = useMapLabStore((s) => s.mapStyle.layers)
  const selectedLayerId = useMapLabStore((s) => s.selectedLayerId)
  const selectLayer = useMapLabStore((s) => s.selectLayer)
  const removeLayer = useMapLabStore((s) => s.removeLayer)
  const setLayerVisible = useMapLabStore((s) => s.setLayerVisible)
  const duplicateLayer = useMapLabStore((s) => s.duplicateLayer)
  const setActivePanel = useMapLabStore((s) => s.setActivePanel)
  const focusLayerNameInput = useMapLabStore((s) => s.focusLayerNameInput)
  const pushToast = useMapLabStore((s) => s.pushToast)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Skip when an input/textarea is focused.
      if (isEditableTarget(e.target)) return

      // ⌘D / Ctrl+D — duplicate the selected layer. Works from any panel.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        if (!selectedLayerId) return
        e.preventDefault()
        const layer = layers.find((l) => l.id === selectedLayerId)
        duplicateLayer(selectedLayerId)
        pushToast(`Duplicated layer "${layer?.name ?? selectedLayerId}"`, 'success')
        return
      }

      // ⌘⇧↑ / ⌘⇧↓ / Ctrl+Shift+ArrowUp/Down — move the selected layer up/down
      // in the render order (reorder). Works from any panel.
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown')
      ) {
        if (!selectedLayerId || layers.length < 2) return
        e.preventDefault()
        const sorted = [...layers].sort((a, b) => a.order - b.order)
        const curIdx = sorted.findIndex((l) => l.id === selectedLayerId)
        if (curIdx < 0) return
        const dir = e.key === 'ArrowUp' ? -1 : 1
        const nextIdx = curIdx + dir
        if (nextIdx < 0 || nextIdx >= sorted.length) return
        // Swap the two layers' order values — the Layers panel re-renders
        // based on the `order` field.
        const cur = sorted[curIdx]!
        const next = sorted[nextIdx]!
        const orderedIds = sorted.map((l) => l.id)
        // Swap positions in the array.
        orderedIds[curIdx] = next.id
        orderedIds[nextIdx] = cur.id
        useMapLabStore.getState().reorderLayers(orderedIds)
        return
      }

      // For the remaining shortcuts (arrows, Delete, V, F2), skip when any
      // modifier is held (so cmd+arrow etc. work natively for the browser).
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key

      // Auto-switch to the Layers panel if not active, so the user sees the
      // selection move / the layer get removed / the visibility toggle.
      if (
        activePanel !== 'layers' &&
        (key === 'ArrowUp' ||
          key === 'ArrowDown' ||
          key === 'Delete' ||
          key === 'Backspace' ||
          key === 'v' ||
          key === 'V' ||
          key === 'F2')
      ) {
        setActivePanel('layers')
      }

      if (key === 'ArrowUp' || key === 'ArrowDown') {
        if (layers.length === 0) return
        e.preventDefault()
        // Layers are rendered in `order` ascending in the panel. Find the
        // current index and move to the previous/next.
        const sorted = [...layers].sort((a, b) => a.order - b.order)
        const curIdx = sorted.findIndex((l) => l.id === selectedLayerId)
        let nextIdx: number
        if (key === 'ArrowUp') {
          nextIdx = curIdx <= 0 ? sorted.length - 1 : curIdx - 1
        } else {
          nextIdx = curIdx < 0 || curIdx >= sorted.length - 1 ? 0 : curIdx + 1
        }
        selectLayer(sorted[nextIdx]?.id ?? null)
      } else if (key === 'Delete' || key === 'Backspace') {
        if (!selectedLayerId) return
        e.preventDefault()
        // Find the layer name for a nicer toast.
        const layer = layers.find((l) => l.id === selectedLayerId)
        removeLayer(selectedLayerId)
        pushToast(`Deleted layer "${layer?.name ?? selectedLayerId}"`, 'info')
      } else if (key === 'v' || key === 'V') {
        if (!selectedLayerId) return
        e.preventDefault()
        const layer = layers.find((l) => l.id === selectedLayerId)
        if (!layer) return
        setLayerVisible(selectedLayerId, !layer.visible)
      } else if (key === 'F2') {
        // F2 — rename the selected layer. Focus the Layer name input via the
        // store's ref (set by the LayerEditor on mount) — no DOM coupling.
        if (!selectedLayerId) return
        e.preventDefault()
        focusLayerNameInput()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    activePanel,
    layers,
    selectedLayerId,
    selectLayer,
    removeLayer,
    setLayerVisible,
    duplicateLayer,
    setActivePanel,
    focusLayerNameInput,
    pushToast,
  ])
}

// Mountable component — renders nothing, just wires all the shortcuts.
export function KeyboardShortcuts() {
  useUndoRedoShortcuts()
  useLayerNavigationShortcuts()
  return null
}
