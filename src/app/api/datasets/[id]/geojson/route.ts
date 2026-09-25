import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// GET /api/datasets/[id]/geojson
// For type=geojson: returns the inline GeoJSON object with
// Content-Type: application/json.
// For type=pmtiles: returns an error telling the caller to use the
// pmtiles URL directly.
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const dataset = await db.dataset.findUnique({ where: { id } })
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }
    if (dataset.type !== 'geojson') {
      return NextResponse.json(
        { error: 'Use pmtiles URL directly' },
        { status: 400 },
      )
    }
    let parsed: unknown = null
    try {
      parsed = JSON.parse(dataset.data)
    } catch {
      parsed = {
        type: 'FeatureCollection',
        features: [],
      }
    }
    return new NextResponse(JSON.stringify(parsed), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
