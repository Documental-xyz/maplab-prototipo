import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// Detect the dominant geometry type of a FeatureCollection.
function detectGeometryType(
  fc: GeoJSON.FeatureCollection,
): string | null {
  const seen = new Set<string>()
  for (const f of fc.features) {
    if (f?.geometry?.type) seen.add(f.geometry.type)
  }
  if (seen.size === 0) return null
  if (seen.size === 1) return [...seen][0]
  // Mixed geometries -> categorize as Mixed.
  // If all are Multi* or single types, we still label Mixed for clarity.
  return 'Mixed'
}

// GET /api/projects/[id]/datasets — list datasets in a project.
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const project = await db.project.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    const datasets = await db.dataset.findMany({
      where: { projectId: id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        format: true,
        fileSize: true,
        featureCount: true,
        geometryType: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ datasets })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/projects/[id]/datasets — create a new dataset.
// Body: { name: string, type: 'geojson'|'pmtiles', data: string | object }
// Query: ?dedup=true — delete existing rows with the same name+type before
// inserting. Used by the Save flow to prevent dataset history from growing
// unbounded (unlike styles, datasets don't need version history).
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const url = new URL(req.url)
    const dedup = url.searchParams.get('dedup') === 'true'
    const body = (await req.json().catch(() => null)) as {
      name?: string
      type?: string
      data?: unknown
    } | null
    if (!body || !body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json(
        { error: 'A non-empty `name` is required' },
        { status: 400 },
      )
    }
    const type = body.type === 'pmtiles' ? 'pmtiles' : 'geojson'
    const format = type === 'pmtiles' ? 'pmtiles' : 'geojson'
    if (body.data == null) {
      return NextResponse.json({ error: '`data` is required' }, { status: 400 })
    }
    const project = await db.project.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    let dataString = ''
    let fileSize = 0
    let featureCount = 0
    let geometryType: string | null = null

    if (type === 'geojson') {
      let fc: GeoJSON.FeatureCollection | null = null
      if (typeof body.data === 'string') {
        dataString = body.data
        try {
          const parsed = JSON.parse(body.data)
          if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
            fc = parsed as GeoJSON.FeatureCollection
          }
        } catch {
          // Not valid JSON — leave fc as null.
        }
      } else if (body.data && typeof body.data === 'object') {
        dataString = JSON.stringify(body.data)
        const obj = body.data as { type?: string; features?: unknown[] }
        if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
          fc = obj as unknown as GeoJSON.FeatureCollection
        }
      } else {
        return NextResponse.json(
          { error: 'GeoJSON datasets require string or object `data`' },
          { status: 400 },
        )
      }
      if (fc) {
        featureCount = fc.features.length
        geometryType = detectGeometryType(fc)
      }
      fileSize = Buffer.byteLength(dataString, 'utf-8')
    } else {
      // type === 'pmtiles' — store the URL string.
      if (typeof body.data !== 'string' || !body.data.trim()) {
        return NextResponse.json(
          { error: 'PMTiles datasets require a URL string in `data`' },
          { status: 400 },
        )
      }
      dataString = body.data.trim()
      fileSize = Buffer.byteLength(dataString, 'utf-8')
    }

    // Dedup: if requested, delete existing rows with the same name+type
    // before inserting the new one. This keeps the dataset list from growing
    // unbounded on repeated saves.
    if (dedup) {
      await db.dataset.deleteMany({
        where: {
          projectId: id,
          name: body.name.trim(),
          type,
        },
      })
    }

    const dataset = await db.dataset.create({
      data: {
        name: body.name.trim(),
        projectId: id,
        type,
        format,
        data: dataString,
        fileSize,
        featureCount,
        geometryType,
      },
    })
    return NextResponse.json({ dataset }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
