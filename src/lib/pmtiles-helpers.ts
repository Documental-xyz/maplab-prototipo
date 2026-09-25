// MapLab Studio — PMTiles helpers (frontend protocol + metadata fetch).
// PMTiles is an open archive format for tiled data: a single file replaces
// millions of tile PNG/WebP files. https://github.com/protomaps/PMTiles

import { PMTiles, Protocol, TileType } from 'pmtiles'

// A single shared Protocol instance for the whole app (registers pmtiles://).
let _protocol: Protocol | null = null
export function getPmTilesProtocol(): Protocol {
  if (!_protocol) {
    _protocol = new Protocol()
  }
  return _protocol
}

// Construct a `pmtiles://` URL for a remote PMTiles resource.
// The frontend maplibre source should use this URL.
export function pmtilesSourceUrl(remoteUrl: string): string {
  // Strip our own protocol prefix if already present.
  if (remoteUrl.startsWith('pmtiles://')) return remoteUrl
  return `pmtiles://${remoteUrl}`
}

// Fetch metadata for a remote PMTiles (header + leaf directories).
// This is used by the Tiles panel to show zoom range, tile count, etc.
export async function fetchPmTilesMeta(remoteUrl: string): Promise<{
  url: string
  totalTiles?: number
  minZoom?: number
  maxZoom?: number
  tileType?: string
  isVector?: boolean
  sourceLayers?: string[]
  error?: string
}> {
  try {
    const p = new PMTiles(remoteUrl)
    const header = await p.getHeader()
    const isVector = header.tileType === TileType.Mvt
    return {
      url: remoteUrl,
      totalTiles: header.numAddressedTiles,
      minZoom: header.minZoom,
      maxZoom: header.maxZoom,
      tileType: isVector
        ? 'MVT (vector)'
        : header.tileType === TileType.Png
          ? 'PNG (raster)'
          : header.tileType === TileType.Jpeg
            ? 'JPEG (raster)'
            : header.tileType === TileType.Webp
              ? 'WebP (raster)'
              : header.tileType === TileType.Avif
                ? 'AVIF (raster)'
                : 'Unknown',
      isVector,
    }
  } catch (e) {
    return {
      url: remoteUrl,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

// Build a MapLibre source object for a PMTiles URL.
export function buildPmTilesMapLibreSource(remoteUrl: string): {
  type: 'vector' | 'raster'
  url: string
  attribution?: string
} {
  // We can't know vector vs raster without reading the header, but the most
  // common PMTiles the user pastes will be vector (Protomaps). We default to
  // vector and let the metadata fetch correct the layer config later.
  return {
    type: 'vector',
    url: pmtilesSourceUrl(remoteUrl),
  }
}

