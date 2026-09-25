# Task ID: 6 — Subagent C (full-stack-developer)

## Task
Build the left sidebar + 7 panels (maps, data, styles, tiles, search, routing, api)
for MapLab Studio. Use only the Zustand store contract from `src/lib/map-store.ts`,
defaults from `src/lib/defaults.ts`, helpers from `src/lib/pmtiles-helpers.ts`,
and the shadcn/ui set in `src/components/ui`. Stay within
`src/components/panels/**` — do NOT touch `src/app/**`, `src/lib/**`,
`src/components/map/**`, `src/components/ui/**`, or the right-panel files.

## Work Log

### Files created (all under `src/components/panels/`)

1. **sidebar.tsx** — exports `Sidebar` (the rail) and `SidebarHeader`.
   - Desktop rail: vertical, 56→224px when expanded, collapses to 56px (icons only).
     9 panel buttons (maps/data/styles/tiles/search/routing/api/layers/inspector),
     each lucide icon + label. Active = `bg-primary text-primary-foreground`.
     Brand mark on top, Collapse toggle at bottom. When collapsed, items show
     a tooltip on hover.
   - Mobile: horizontal scrollable strip at the top with brand mark + icon+label
     buttons.
   - `SidebarHeader` shows the active panel title.

2. **maps-panel.tsx** — project metadata editor (name Input, description Textarea,
   dirty/saved badge, project id). "Base map" section as a 2-3 col grid of
   basemap cards (preview image, name, attribution, category badge, ring when
   selected). Project actions: New style, Import, Publish, Share (each wired to
   the store).

3. **data-panel.tsx** — lists every `mapStyle.sources` row with name, type
   badge (emerald=geojson / amber=vector+pmtiles / rose=raster / orange=dem /
   violet=image — never blue/indigo), feature count for inline GeoJSON, and a
   remove (trash) button. Tabs to add a dataset: GeoJSON (paste + file) or
   PMTiles URL (with quick-pick buttons for `DEMO_PMTILES`). Uses
   `pmtilesSourceUrl()` for pmtiles sources.

4. **styles-panel.tsx** — current style row (Collapsible showing layer/source
   counts, id, version, center). `useSaveStyle()` hook is a no-op stub with
   TODO comment for the backend agent to wire the real POST. Import Mapbox
   style form is also a TODO stub that just `pushToast`s. Export Mapbox style
   **works end-to-end**: calls `exportMapboxStyle()`, stringifies, creates a
   Blob and triggers a `.json` download via an anchor element.

5. **tiles-panel.tsx** — lists all sources. For pmtiles sources, a Collapsible
   "Load metadata" button calls `fetchPmTilesMeta(url)` and shows min/max zoom,
   tile type, total tile count in a 2-col grid. Add-tile-source form has a
   Select for type (pmtiles/vector/raster/raster-dem), URL, name, optional
   attribution. Demos list as quick-add buttons.

6. **search-panel.tsx** — search Input with magnifier icon, Enter or button
   submits → `GET /api/search?q=<q>` (relative path, gateway handles routing).
   Loading skeleton list, empty state with hint text, error toast via `sonner`.
   Each result row shows `display_name` (split into primary + secondary on the
   first comma), lat/lon in mono font, and a "Fly to" button that calls
   `flyTo([lon, lat], 14)`.

7. **routing-panel.tsx** — From / To text inputs accepting `lat,lng`. "Use map
   center" buttons fill the inputs from `view.center` (converted from
   [lng,lat] to lat,lng form). Profile Select (driving/walking/cycling).
   "Calculate route" → `GET /api/route-plan?from=&to=&profile=`. On success
   shows distance (km) + duration (min) summary card and flies to the
   midpoint of the two endpoints.

8. **api-panel.tsx** — disabled "API key" Input with tooltip
   "Self-hosted — no key needed". List of all 7 endpoints with method badge
   (green=GET, amber=POST, red=DELETE; NO blue/indigo), mono-font path,
   description, copy-to-clipboard button (lucide Copy → Check on success).
   Below: a "Try it" card with a cURL preview and copy button.

### Verification

- `cd /home/z/my-project && bun run lint` — passes with **0 errors** in
  Subagent C's files. Remaining 3 warnings are in files outside this scope
  (map-view.tsx, layer-editor.tsx, top-bar.tsx — owned by other agents).
- `bunx tsc --noEmit` reports errors only in files outside this scope
  (maplibre-gl default export, layer-editor types, pmtiles-helpers
  `tileCount` field, map-style `coordinates` on SourceSpec) — all owned by
  other agents.
- Did not touch `src/app/**`, `src/lib/**`, `src/components/map/**`,
  `src/components/ui/**`, or the right-panel components.
- Did not modify `page.tsx`, did not start the dev server.

### Caveats / TODOs for the backend agent

- `styles-panel.tsx`: `useSaveStyle()` is a no-op stub. Wire it to POST
  `/api/projects/[id]/styles` (TODO comment in source).
- `styles-panel.tsx`: Import Mapbox style button currently only toasts. Wire
  to `fromMapboxStyle()` after fetching JSON (TODO comment in source).
- `data-panel.tsx` & `tiles-panel.tsx`: PMTiles metadata fetch uses
  `fetchPmTilesMeta()` from `src/lib/pmtiles-helpers.ts`. The lib has a TS
  error (`header.tileCount` not on the PMTiles `Header` type) that the
  foundation agent should patch; the runtime call still works.
- `search-panel.tsx` & `routing-panel.tsx`: API calls use relative paths
  (`/api/search`, `/api/route-plan`) and rely on the gateway to dispatch to
  the backend route handler. Response shape expected: search = Nominatim-style
  `SearchResult[]` (`{ display_name, lat, lon, place_id, type }`);
  route-plan = `{ distance: number (km), duration: number (min), error?: string }`.
- Sidebar rail is intentionally a sibling of panel content (parent `page.tsx`
  will lay them out via flex). `Sidebar` and `SidebarHeader` are the public
  exports.

## Stage Summary
- 8 new client components delivered, all under `src/components/panels/`.
- Public exports: `Sidebar`, `SidebarHeader`, `MapsPanel`, `DataPanel`,
  `StylesPanel`, `TilesPanel`, `SearchPanel`, `RoutingPanel`, `ApiPanel`.
- All panels read/write `useMapLabStore`. The store contract from Task 1 was
  followed exactly — no new store fields needed.
- Lint clean for all files in scope.
