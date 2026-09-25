import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
// Allow up to 30s for fetching remote styles.
export const maxDuration = 30

// GET /api/proxy?url=<remote>
// Generic CORS-bypassing proxy for JSON/text resources (e.g. remote Mapbox
// style JSONs that don't send `Access-Control-Allow-Origin`). Streams the
// upstream response back with `Access-Control-Allow-Origin: *` and the
// upstream Content-Type. Used by the ImportDialog's "Mapbox Style" tab when
// a direct fetch() fails due to CORS.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const remoteUrl = searchParams.get('url')

    if (!remoteUrl) {
      return NextResponse.json(
        { error: 'Missing `url` query parameter' },
        { status: 400 },
      )
    }
    // Only allow http(s) URLs — no file:// or relative URLs.
    if (!/^https?:\/\//i.test(remoteUrl)) {
      return NextResponse.json(
        { error: '`url` must be an http(s) URL' },
        { status: 400 },
      )
    }

    try {
      // Validate the URL parses cleanly.
      void new URL(remoteUrl)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 },
      )
    }

    const upstream = await fetch(remoteUrl, {
      // Use a conservative UA so we don't get blocked by OSM-style filters.
      headers: {
        'User-Agent': 'MapLab-Studio/0.2 (+https://github.com/maplab)',
        Accept: 'application/json,text/plain,*/*',
      },
    })

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: `Upstream returned ${upstream.status} ${upstream.statusText}`,
        },
        { status: 502 },
      )
    }

    const body = await upstream.text()
    const contentType =
      upstream.headers.get('content-type') ?? 'application/json'

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
        'X-Proxied-By': 'maplab-proxy',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
