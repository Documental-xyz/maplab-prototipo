// MapLab Studio — default basemaps, style presets and starter layers.
// Uses 100% open data: OpenStreetMap raster tiles, DEMO PMTiles, etc.

import type { Basemap, LayerSpec, MapStyle, SourceSpec } from './types'

// Open basemaps (no API key required).
// We use community OSM raster + the official MapLibre demo styles (CC-BY).
export const BASEMAPS: Basemap[] = [
  {
    id: 'osm-liberty',
    name: 'OSM Liberty',
    styleUrl:
      'https://demotiles.maplibre.org/style.json',
    preview:
      'https://raw.githubusercontent.com/maplibre/demotiles/main/img/osm-liberty.png',
    attribution: '© OpenStreetMap contributors',
    category: 'osm',
  },
  {
    id: 'liberty',
    name: 'Liberty (MapLibre)',
    styleUrl: 'https://demotiles.maplibre.org/liberty/style.json',
    preview:
      'https://raw.githubusercontent.com/maplibre/demotiles/main/img/liberty.png',
    attribution: '© MapLibre',
    category: 'light',
  },
  {
    id: 'positron',
    name: 'Positron (Light)',
    styleUrl:
      'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    preview:
      'https://carto.com/help/images/building-maps/glsdk-light-labels.png',
    attribution: '© CARTO, © OpenStreetMap contributors',
    category: 'light',
  },
  {
    id: 'dark-matter',
    name: 'Dark Matter (Dark)',
    styleUrl:
      'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    preview:
      'https://carto.com/help/images/building-maps/glsdk-dark-labels.png',
    attribution: '© CARTO, © OpenStreetMap contributors',
    category: 'dark',
  },
  {
    id: 'voyager',
    name: 'Voyager',
    styleUrl:
      'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    preview:
      'https://carto.com/help/images/building-maps/voyager-style.png',
    attribution: '© CARTO, © OpenStreetMap contributors',
    category: 'light',
  },
  {
    id: 'satellite',
    name: 'Esri Satellite',
    styleUrl:
      'https://raw.githubusercontent.com/maptiler/tilejson-gl-style/refs/heads/master/style-esri-satellite.json',
    preview:
      'https://www.esri.com/arcgis-blog/wp-content/uploads/2019/04/satellite.jpg',
    attribution: '© Esri, Maxar, Earthstar Geographics',
    category: 'satellite',
  },
  {
    id: 'protomaps-light',
    name: 'Protomaps Light',
    styleUrl:
      'https://api.protomaps.com/styles/v2/light.json',
    preview: '',
    attribution: '© Protomaps, © OpenStreetMap contributors',
    category: 'light',
  },
]

// Curated PMTiles demo sources (no API key, public CORS).
export const DEMO_PMTILES: { name: string; url: string; description: string }[] = [
  {
    name: 'Protomaps Earth',
    url: 'https://protomaps.github.io/PMTiles/protomaps(vector)v4.pmtiles',
    description: 'Global OpenStreetMap base layer (Protomaps v4).',
  },
  {
    name: 'US Large Cities',
    url: 'https://docs.protomaps.com/img/us-cities.pmtiles',
    description: 'Large US cities — point vector features.',
  },
  {
    name: 'World Countries',
    url: 'https://r2-public.protomaps.com/countries.pmtiles',
    description: 'World country polygons.',
  },
]

// Colour palette presets for the style editor.
export const COLOR_PRESETS = [
  '#e4192b', '#e8743b', '#f2c14d', '#9bc53d', '#3fa34d',
  '#2a9d8f', '#1d7a99', '#2266b3', '#5d3fd3', '#a433c2',
  '#e84a99', '#6b7280', '#1f2937', '#f3f4f6', '#0f172a',
]

export const FONT_PRESETS = [
  'Open Sans Regular',
  'Open Sans Bold',
  'Noto Sans Regular',
  'Noto Sans Bold',
  'Inter Regular',
  'Inter Bold',
]

// Build a default MapLibre style: background + water line + a starter polygon.
export function createDefaultStyle(): MapStyle {
  const sources: SourceSpec[] = [
    {
      id: 'default-points',
      name: 'Sample Points',
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Reykjavík', category: 'capital' },
            geometry: { type: 'Point', coordinates: [-21.9426, 64.1466] },
          },
          {
            type: 'Feature',
            properties: { name: 'Akureyri', category: 'town' },
            geometry: { type: 'Point', coordinates: [-18.0894, 65.6839] },
          },
        ],
      },
    },
    {
      id: 'default-polygons',
      name: 'Sample Polygons',
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Zone A', kind: 'residential' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-21.95, 64.15],
                  [-21.92, 64.15],
                  [-21.92, 64.16],
                  [-21.95, 64.16],
                  [-21.95, 64.15],
                ],
              ],
            },
          },
          {
            type: 'Feature',
            properties: { name: 'Zone B', kind: 'commercial' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-21.94, 64.145],
                  [-21.93, 64.145],
                  [-21.93, 64.155],
                  [-21.94, 64.155],
                  [-21.94, 64.145],
                ],
              ],
            },
          },
        ],
      },
    },
    {
      id: 'default-lines',
      name: 'Sample Lines',
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Route 1', kind: 'road' },
            geometry: {
              type: 'LineString',
              coordinates: [
                [-21.95, 64.145],
                [-21.93, 64.15],
                [-21.91, 64.16],
              ],
            },
          },
        ],
      },
    },
  ]

  const layers: LayerSpec[] = [
    {
      id: 'background',
      name: 'Background',
      type: 'background',
      sourceId: null,
      paint: { 'background-color': '#f5f5f4', 'background-opacity': 1 },
      layout: {},
      visible: true,
      order: 0,
      minzoom: 0,
      maxzoom: 24,
    },
    {
      id: 'polygons-fill',
      name: 'Polygon Fill',
      type: 'fill',
      sourceId: 'default-polygons',
      paint: {
        'fill-color': '#3fa34d',
        'fill-opacity': 0.4,
      },
      layout: {},
      visible: true,
      order: 1,
      minzoom: 0,
      maxzoom: 24,
    },
    {
      id: 'polygons-outline',
      name: 'Polygon Outline',
      type: 'line',
      sourceId: 'default-polygons',
      paint: {
        'line-color': '#2a9d8f',
        'line-width': 2,
        'line-opacity': 1,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      visible: true,
      order: 2,
      minzoom: 0,
      maxzoom: 24,
    },
    {
      id: 'lines',
      name: 'Line Routes',
      type: 'line',
      sourceId: 'default-lines',
      paint: {
        'line-color': '#e8743b',
        'line-width': 3,
        'line-opacity': 0.9,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      visible: true,
      order: 3,
      minzoom: 0,
      maxzoom: 24,
    },
    {
      id: 'points',
      name: 'City Points',
      type: 'circle',
      sourceId: 'default-points',
      paint: {
        'circle-radius': 8,
        'circle-color': '#e4192b',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity': 0.9,
      },
      layout: {},
      visible: true,
      order: 4,
      minzoom: 0,
      maxzoom: 24,
    },
  ]

  return {
    id: 'default',
    name: 'MapLab Default Style',
    version: 8,
    sources,
    layers,
    view: {
      center: [-21.9426, 64.1466], // Reykjavík
      zoom: 11,
      bearing: 0,
      pitch: 0,
    },
    sprite: '',
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  }
}

// Default paint presets when adding a new layer of a given type.
export function defaultPaintForType(
  type: LayerSpec['type'],
): Record<string, unknown> {
  switch (type) {
    case 'background':
      return { 'background-color': '#e7e5e4', 'background-opacity': 1 }
    case 'fill':
      return {
        'fill-color': '#3fa34d',
        'fill-opacity': 0.5,
        'fill-outline-color': '#1f6f54',
      }
    case 'fill-extrusion':
      return {
        'fill-extrusion-color': '#9bc53d',
        'fill-extrusion-height': 50,
        'fill-extrusion-opacity': 0.85,
      }
    case 'line':
      return {
        'line-color': '#2a9d8f',
        'line-width': 2,
        'line-opacity': 1,
      }
    case 'circle':
      return {
        'circle-radius': 7,
        'circle-color': '#e4192b',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity': 0.95,
      }
    case 'raster':
      return { 'raster-opacity': 1 }
    case 'heatmap':
      return {
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(0,0,255,0)',
          0.5,
          '#2a9d8f',
          1,
          '#e4192b',
        ],
        'heatmap-intensity': 1,
        'heatmap-radius': 25,
      }
    case 'hillshade':
      return {
        'hillshade-illumination-direction': 335,
        'hillshade-shadow-color': '#473b29',
      }
    case 'symbol':
    default:
      return {}
  }
}
