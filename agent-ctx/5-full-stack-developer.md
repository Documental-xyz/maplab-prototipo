# Task ID: 5
# Agent: full-stack-developer (Subagent B)
# Scope: MapLibre map components

## Task
Build the central MapLibre map surface plus its floating chrome (draw toolbar,
navigation controls, attribution bar) for MapLab Studio. All map components
read/write the shared Zustand store (`@/lib/map-store`) and follow the strict
contract fixed in Task 1 (types / defaults / pmtiles-helpers / map-store).

## Files created (in `src/components/map/`)
1. `map-view.tsx` — the central MapLibre map. Registers the shared PMTiles
   protocol once at module scope, creates the map with the active basemap's
   `styleUrl`, then layers the user's sources + visible layers on top of the
   basemap. Handles: bidirectional view sync (debounced `setView` on
   `moveend`, `jumpTo` on external view changes), `flyToTrigger`, basemap
   switching via `setStyle({ diff:false })`, click → `selectLayer`. Exposes
   a `useMap()` context hook + `<MapContext.Provider>` so children can grab
   the live `maplibregl.Map` instance without prop-drilling.
2. `draw-control.tsx` — wraps `@mapbox/mapbox-gl-draw` (compatible with
   MapLibre GL). Captures every drawn feature into a separate `__drawn`
   GeoJSON source + 3 geometry-specific layers (fill / line / circle) so
   drawings persist visually across basemap switches. Subscribes to the
   store's `drawMode`, calling `draw.changeMode(mode)` (or
   `deleteAll() + simple_select` when null). Includes a "Clear drawings"
   button at the top-center.
3. `map-controls.tsx` — vertical stack of touch-friendly (44px) icon
   buttons in the bottom-right: zoom in / out, reset-north, pitch toggle,
   geolocate, fullscreen. Uses lucide-react icons and shadcn `Button`.
4. `map-attribution.tsx` — small muted chip at bottom-left showing the
   active basemap's attribution text from `BASEMAPS`.

## Key implementation notes / caveats
- **PMTiles v4 Protocol API confirmed**: `new Protocol()` exposes a `.tile`
  method, which we register via `maplibregl.addProtocol('pmtiles',
  protocol.tile)`. Works correctly with the helper in
  `src/lib/pmtiles-helpers.ts`.
- **Background layers in user style are skipped** when applying user style on
  top of the basemap. A user background layer with full opacity would
  otherwise paint over the entire basemap (which defeats the hybrid
  basemap + user-style architecture). The basemap itself is treated as the
  background. This affects the default style (which ships with a background
  layer) — on initial load users will see the chosen basemap, not the
  `#f5f5f4` background fill.
- **User-style re-application** uses the simple "tear down all user layers
  + sources, then re-add in render order" strategy prescribed in the task
  description. This may cause a brief flicker on every store-driven paint
  change; a smarter diff (setPaintProperty / setLayoutProperty /
  setLayerZoomRange / setFilter) would be a future optimisation.
- **DrawControl survives basemap switches** by listening to `style.load`
  and fully rebuilding the MapboxDraw control + `__drawn` source/layers.
  `drawnFeaturesRef` (a plain React ref holding the FeatureCollection)
  persists across rebuilds so drawings aren't lost. The `__drawn` layers
  are also pushed to the top of the render stack whenever `mapStyle`
  changes (via `map.moveLayer(id)`) so they stay above user layers.
- **View-sync feedback loops** are prevented two ways: (1) an
  `isExternalUpdate` ref set to true during synchronous `jumpTo` calls and
  reset on the next microtask; (2) a numeric `approxEq` check inside the
  `moveend` handler so `setView` isn't called when the store already matches
  the map. The store's `view` effect also short-circuits when the map is
  already at the requested position.
- **Touch targets**: `MapControls` buttons use `h-11 w-11` (44px) per the
  accessibility spec; `DrawControl`'s clear button uses `h-9` (36px) since
  it's a secondary action with a tooltip.
- **No new dependencies were added** — every import resolves to packages
  already installed by Task 1 (`maplibre-gl`, `pmtiles`,
  `@mapbox/mapbox-gl-draw`, `lucide-react`, `@/components/ui/button`).

## Verification
- `cd /home/z/my-project && bun run lint` → **0 errors, 0 warnings**.
- Dev server log shows continued successful compilation after the new files
  were added (no module-resolution or SSR-related errors).
- The components do NOT touch `src/app/page.tsx`, `src/app/layout.tsx`,
  `src/app/globals.css`, `src/lib/**`, `src/app/api/**`,
  `src/components/panels/**`, or `src/components/ui/**`.

## Stage Summary
The map surface is ready for the main agent to wire up. Main agent's job is
to drop `<MapView>` into `page.tsx` with `<DrawControl />`, `<MapControls />`,
and `<MapAttribution />` as children. The store contract holds:
- MapView reads `mapStyle`, `basemapId`, `view`, `flyToTrigger`; calls
  `setView`, `selectLayer`, `clearFlyTo`.
- DrawControl reads `drawMode`, `mapStyle`; calls `setDrawMode`, `pushToast`.
- MapControls reads nothing from the store (pure imperative map calls) but
  does call `pushToast` for error feedback.
- MapAttribution reads `basemapId`.
