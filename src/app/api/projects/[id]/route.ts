import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// GET /api/projects/[id] — single project with relations.
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const project = await db.project.findUnique({
      where: { id },
      include: {
        styles: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            isPublished: true,
            updatedAt: true,
            createdAt: true,
          },
        },
        datasets: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            type: true,
            format: true,
            featureCount: true,
            fileSize: true,
            geometryType: true,
            updatedAt: true,
          },
        },
        tileSources: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            type: true,
            url: true,
            minzoom: true,
            maxzoom: true,
            updatedAt: true,
          },
        },
      },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    return NextResponse.json({ project })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/projects/[id] — update name / description.
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = (await req.json().catch(() => null)) as {
      name?: string
      description?: string | null
    } | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const data: { name?: string; description?: string | null } = {}
    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim()
    }
    if (typeof body.description === 'string') {
      data.description = body.description.trim() || null
    } else if (body.description === null) {
      data.description = null
    }
    const updated = await db.project.update({
      where: { id },
      data,
    })
    return NextResponse.json({ project: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/projects/[id] — cascade delete (handled by Prisma onDelete: Cascade).
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    await db.project.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
