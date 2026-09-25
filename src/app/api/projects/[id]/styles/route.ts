import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapStyleToPrismaData } from '@/lib/server-style'
import type { MapStyle } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// GET /api/projects/[id]/styles — list all styles in a project.
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
    const styles = await db.style.findMany({
      where: { projectId: id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        version: true,
        centerLng: true,
        centerLat: true,
        zoom: true,
        bearing: true,
        pitch: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ styles })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/projects/[id]/styles — save a new style.
// Body: { name: string, spec: MapStyle }
// After inserting, auto-prunes old non-published styles so a project keeps
// at most MAX_STYLES history rows. Published styles are never pruned.
const MAX_STYLES = 10
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = (await req.json().catch(() => null)) as {
      name?: string
      spec?: MapStyle
    } | null
    if (!body || !body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json(
        { error: 'A non-empty `name` is required' },
        { status: 400 },
      )
    }
    if (!body.spec || typeof body.spec !== 'object') {
      return NextResponse.json({ error: '`spec` (MapStyle) is required' }, { status: 400 })
    }
    const project = await db.project.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    const style = await db.style.create({
      data: mapStyleToPrismaData(body.spec, id),
    })

    // Auto-prune: if the project now has more than MAX_STYLES rows, delete
    // the oldest non-published ones. Published styles are preserved so the
    // user can always roll back to a version they shared.
    try {
      const allStyles = await db.style.findMany({
        where: { projectId: id },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, isPublished: true },
      })
      // Skip the first MAX_STYLES rows (the newest, including the one we
      // just created). Anything older AND not published is a prune candidate.
      const pruneCandidates = allStyles
        .slice(MAX_STYLES)
        .filter((s) => !s.isPublished)
        .map((s) => s.id)
      if (pruneCandidates.length > 0) {
        await db.style.deleteMany({
          where: { id: { in: pruneCandidates } },
        })
      }
    } catch {
      // Pruning is best-effort — don't fail the save if it errors.
    }

    return NextResponse.json({ style }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
