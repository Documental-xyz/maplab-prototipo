import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/search?q=<query>
// Proxies to OpenStreetMap's Nominatim service with a proper User-Agent.
// Returns an array of { display_name, lat, lon, type, importance }.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || searchParams.get('query')
    if (!q || !q.trim()) {
      return NextResponse.json(
        { error: 'Missing `q` query parameter' },
        { status: 400 },
      )
    }
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      q.trim(),
    )}&limit=5&addressdetails=0`
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        // Nominatim's usage policy requires a meaningful User-Agent.
        'User-Agent': 'MapLab-Studio/1.0 (https://github.com/maplab)',
        Accept: 'application/json',
      },
      // We don't want to cache too aggressively — Nominatim rate-limits.
      cache: 'no-store',
    })
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return NextResponse.json(
        {
          error: `Nominatim responded with ${upstream.status}`,
          upstream: text.slice(0, 500),
        },
        { status: 502 },
      )
    }
    const raw = (await upstream.json().catch(() => [])) as Array<{
      display_name?: string
      lat?: string | number
      lon?: string | number
      type?: string
      importance?: number
    }>
    const results = raw.map((item) => ({
      display_name: item.display_name ?? '',
      lat: typeof item.lat === 'string' ? Number.parseFloat(item.lat) : (item.lat ?? 0),
      lon: typeof item.lon === 'string' ? Number.parseFloat(item.lon) : (item.lon ?? 0),
      type: item.type ?? 'unknown',
      importance: item.importance ?? 0,
    }))
    return NextResponse.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
