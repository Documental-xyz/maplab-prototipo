import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// GET /api/projects/[id]/tilesources — list tile sources in a project.
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
    const tileSources = await db.tileSource.findMany({
      where: { projectId: id },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json({ tileSources })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/projects/[id]/tilesources — create a tile source.
// Body: { name, type, url, tileSize?, attribution?, minzoom?, maxzoom?, sourceLayer? }
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = (await req.json().catch(() => null)) as {
      name?: string
      type?: string
      url?: string
      tileSize?: number
      attribution?: string
      minzoom?: number
      maxzoom?: number
      sourceLayer?: string
    } | null
    if (!body || !body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json(
        { error: 'A non-empty `name` is required' },
        { status: 400 },
      )
    }
    if (!body.type || typeof body.type !== 'string') {
      return NextResponse.json({ error: '`type` is required' }, { status: 400 })
    }
    if (!body.url || typeof body.url !== 'string' || !body.url.trim()) {
      return NextResponse.json({ error: '`url` is required' }, { status: 400 })
    }
    const project = await db.project.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    const tileSource = await db.tileSource.create({
      data: {
        name: body.name.trim(),
        projectId: id,
        type: body.type,
        url: body.url.trim(),
        tileSize: typeof body.tileSize === 'number' ? body.tileSize : 256,
        attribution: body.attribution?.trim() || null,
        minzoom: typeof body.minzoom === 'number' ? body.minzoom : 0,
        maxzoom: typeof body.maxzoom === 'number' ? body.maxzoom : 14,
        sourceLayer: body.sourceLayer?.trim() || null,
      },
    })
    return NextResponse.json({ tileSource }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
