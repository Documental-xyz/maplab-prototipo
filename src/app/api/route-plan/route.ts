import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type RouteProfile = 'driving' | 'walking' | 'cycling' | 'foot' | 'bike' | 'car'

// Parse a "lng,lat" coordinate string into [lng, lat].
function parseCoord(raw: string | null, name: string): [number, number] | null {
  if (!raw) return null
  const parts = raw.split(',').map((s) => Number.parseFloat(s.trim()))
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
    return null
  }
  const [lng, lat] = parts
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return null
  }
  // Tag with name for error messages — using a tuple to satisfy the
  // return type without changing the runtime contract.
  void name
  return [lng, lat]
}

// GET /api/route-plan?from=<lng,lat>&to=<lng,lat>&profile=driving|walking|cycling
// Proxies to the public OSRM demo server and returns a normalized
// { distance, duration, geometry } response.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const fromRaw = searchParams.get('from')
    const toRaw = searchParams.get('to')
    const profileRaw = searchParams.get('profile') as RouteProfile | null

    const profile: RouteProfile =
      profileRaw === 'walking' || profileRaw === 'foot'
        ? 'foot'
        : profileRaw === 'cycling' || profileRaw === 'bike'
          ? 'bike'
          : 'driving'

    // OSRM demo only supports driving / walking / cycling profiles.
    // Map our normalized profile back to OSRM's accepted names.
    const osrmProfile =
      profile === 'foot' ? 'foot' : profile === 'bike' ? 'bike' : 'driving'

    const from = parseCoord(fromRaw, 'from')
    const to = parseCoord(toRaw, 'to')
    if (!from) {
      return NextResponse.json(
        { error: '`from` must be `lng,lat` with valid coordinates' },
        { status: 400 },
      )
    }
    if (!to) {
      return NextResponse.json(
        { error: '`to` must be `lng,lat` with valid coordinates' },
        { status: 400 },
      )
    }

    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson&steps=false`
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'MapLab-Studio/1.0 (https://github.com/maplab)',
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return NextResponse.json(
        {
          error: `OSRM responded with ${upstream.status}`,
          upstream: text.slice(0, 500),
        },
        { status: 502 },
      )
    }
    const raw = (await upstream.json().catch(() => null)) as {
      code?: string
      message?: string
      routes?: Array<{
        distance?: number
        duration?: number
        geometry?: GeoJSON.LineString
      }>
    } | null
    if (!raw || raw.code !== 'Ok' || !raw.routes || raw.routes.length === 0) {
      return NextResponse.json(
        {
          error: raw?.message || raw?.code || 'No route found',
          distance: 0,
          duration: 0,
          geometry: { type: 'LineString', coordinates: [from, to] } as GeoJSON.LineString,
        },
        { status: 404 },
      )
    }
    const route = raw.routes[0]
    return NextResponse.json({
      distance: route.distance ?? 0,
      duration: route.duration ?? 0,
      geometry:
        route.geometry ?? ({ type: 'LineString', coordinates: [from, to] } as GeoJSON.LineString),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
