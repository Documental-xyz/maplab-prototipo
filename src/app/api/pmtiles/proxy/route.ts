import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
// Allow the proxy to run for a long time when streaming tile byte ranges.
export const maxDuration = 60

// CORS preflight — the MapLibre / pmtiles client may issue OPTIONS first.
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Access-Control-Max-Age': '86400',
    },
  })
}

// GET /api/pmtiles/proxy?url=<remote>&offset=<n>&length=<m>
// Acts as a Range-request proxy for PMTiles hosts that don't support CORS.
// Streams the response body back with `Content-Type: application/octet-stream`
// and `Access-Control-Allow-Origin: *`.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const remoteUrl = searchParams.get('url')
    const offsetRaw = searchParams.get('offset')
    const lengthRaw = searchParams.get('length')

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
    const offset = offsetRaw != null ? Number.parseInt(offsetRaw, 10) : 0
    const length = lengthRaw != null ? Number.parseInt(lengthRaw, 10) : 0
    if (!Number.isFinite(offset) || offset < 0) {
      return NextResponse.json(
        { error: '`offset` must be a non-negative integer' },
        { status: 400 },
      )
    }
    if (!Number.isFinite(length) || length <= 0) {
      return NextResponse.json(
        { error: '`length` must be a positive integer' },
        { status: 400 },
      )
    }

    const endByte = offset + length - 1
    const upstream = await fetch(remoteUrl, {
      method: 'GET',
      headers: {
        // Standard HTTP Range unit. End byte is inclusive.
        Range: `bytes=${offset}-${endByte}`,
        // Some PMTiles hosts (e.g. GitHub Pages) behave better with an
        // explicit User-Agent, but Next.js's fetch sets a default one.
        Accept: '*/*',
      },
      // Don't follow redirects silently — return them as a hint.
      redirect: 'follow',
    })

    if (!upstream.ok && upstream.status !== 206 && upstream.status !== 200) {
      const bodyText = await upstream.text().catch(() => '')
      return NextResponse.json(
        {
          error: `Upstream responded with ${upstream.status}`,
          upstream: bodyText.slice(0, 500),
        },
        { status: 502 },
      )
    }

    // Pass through upstream Range-related headers when present.
    const headers = new Headers()
    headers.set('Content-Type', 'application/octet-stream')
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
    headers.set('Accept-Ranges', 'bytes')
    if (upstream.headers.get('content-range')) {
      headers.set('Content-Range', upstream.headers.get('content-range') as string)
    }
    if (upstream.headers.get('content-length')) {
      headers.set('Content-Length', upstream.headers.get('content-length') as string)
    } else if (upstream.body) {
      // Fall back to the requested length when upstream doesn't tell us.
      headers.set('Content-Length', String(length))
    }
    // Cache-Control: short-lived to keep tiles snappy but still fresh.
    headers.set('Cache-Control', 'public, max-age=300')

    if (!upstream.body) {
      // No streaming body — return an empty response with the right headers.
      return new NextResponse(null, { status: 200, headers })
    }

    // Stream the upstream body through to the client.
    return new NextResponse(upstream.body as ReadableStream<Uint8Array>, {
      status: 200,
      headers,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
