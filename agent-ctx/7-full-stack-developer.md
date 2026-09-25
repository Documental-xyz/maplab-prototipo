# Task ID 7 — full-stack-developer (Subagent D)

## Scope
Built the editor-facing chrome of MapLab Studio (top bar, layers list
panel, layer editor right panel, feature inspector, publish/import/share
dialogs). Stayed strictly inside `src/components/**`; did NOT touch
`src/app/**`, `src/lib/**`, `src/components/map/**`,
`src/components/ui/**`, or the sidebar/data/styles/tiles/search/routing/api
panels (Subagent C owns those).

## Files created
- `src/components/top-bar.tsx`
- `src/components/panels/layers-panel.tsx`
- `src/components/panels/layer-editor.tsx`
- `src/components/panels/inspector.tsx`
- `src/components/publish-dialog.tsx`
- `src/components/import-dialog.tsx`
- `src/components/share-dialog.tsx`

## Store contract consumed
`useMapLabStore` selectors/mutators used: `project`, `setProject`, `dirty`,
`drawMode`, `setDrawMode`, `activePanel`, `selectedLayerId`, `selectLayer`,
`mapStyle.layers`, `mapStyle.sources`, `addLayer`, `updateLayer`,
`removeLayer`, `duplicateLayer`, `reorderLayers`, `setLayerName`,
`setLayerPaint`, `setLayerLayout`, `setLayerVisible`, `setLayerZoom`,
`setLayerFilter`, `addSource`, `publishOpen`, `setPublishOpen`,
`importOpen`, `setImportOpen`, `shareOpen`, `setShareOpen`, `pushToast`,
`newStyle`, `loadStyle`.

External helpers consumed from `src/lib`:
- `defaultPaintForType`, `COLOR_PRESETS`, `FONT_PRESETS`, `DEMO_PMTILES`
  from `@/lib/defaults`
- `pmtilesSourceUrl` from `@/lib/pmtiles-helpers`
- `cn` from `@/lib/utils`

## Verification
- `bun run lint`: 0 errors, 0 warnings on my files.
- `npx tsc --noEmit`: 0 type errors on my files.
- Did NOT start the dev server, did NOT modify `page.tsx`.

## TODOs left
- `TopBar.handleSave` — wire to `PATCH /api/projects/{id}` once available.
- `ImportDialog` Mapbox Style tab — wire to `fromMapboxStyle()` +
  `loadStyle()`.
- `ShareDialog` QR — real QR generation library.

## Integration notes for the integration agent
All components are pure consumers of `useMapLabStore` and the shadcn UI
kit. They mount anywhere with no props:

```tsx
<TopBar />
<LayersPanel />       // when activePanel === 'layers'
<LayerEditor />       // inside the right panel (visible when rightPanelOpen)
<Inspector />         // when activePanel === 'inspector'
<PublishDialog />
<ImportDialog />
<ShareDialog />
```

The three dialogs are self-controlled via the store — mount them once at
the root and they will toggle themselves.
