import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// GET /api/datasets/[id] — return a single dataset (omitting the bulky
// `data` column when it's PMTiles; for geojson we return the parsed object).
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const dataset = await db.dataset.findUnique({ where: { id } })
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }
    // For geojson datasets, parse the inline data into an object.
    let data: unknown = null
    if (dataset.type === 'geojson') {
      try {
        data = JSON.parse(dataset.data)
      } catch {
        data = dataset.data // fall back to raw string
      }
    } else {
      data = dataset.data // URL string for pmtiles
    }
    return NextResponse.json({
      dataset: {
        id: dataset.id,
        name: dataset.name,
        projectId: dataset.projectId,
        type: dataset.type,
        format: dataset.format,
        fileSize: dataset.fileSize,
        featureCount: dataset.featureCount,
        geometryType: dataset.geometryType,
        createdAt: dataset.createdAt,
        updatedAt: dataset.updatedAt,
        data,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/datasets/[id]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    await db.dataset.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
