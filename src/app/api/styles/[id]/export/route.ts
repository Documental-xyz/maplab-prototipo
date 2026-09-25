import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prismaStyleToMapStyle, serverToMapboxStyle } from '@/lib/server-style'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// GET /api/styles/[id]/export
// Returns the Mapbox v8 style JSON document with Content-Disposition
// attachment header so browsers download it as `<name>.json`.
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const row = await db.style.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: 'Style not found' }, { status: 404 })
    }
    const mapStyle = prismaStyleToMapStyle(row)
    const doc = serverToMapboxStyle(mapStyle)
    const safeName = (row.name || 'style').replace(/[^a-z0-9-_]+/gi, '_')
    const json = JSON.stringify(doc, null, 2)
    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
