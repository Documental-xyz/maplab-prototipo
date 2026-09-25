import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  mapStyleToPrismaData,
  prismaStyleToMapStyle,
} from '@/lib/server-style'
import type { MapStyle } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// GET /api/styles/[id] — return the style row with parsed `spec`.
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const row = await db.style.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: 'Style not found' }, { status: 404 })
    }
    const spec = prismaStyleToMapStyle(row)
    return NextResponse.json({
      style: {
        id: row.id,
        name: row.name,
        projectId: row.projectId,
        version: row.version,
        isPublished: row.isPublished,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        spec,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/styles/[id] — update name / spec / published.
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = (await req.json().catch(() => null)) as {
      name?: string
      spec?: MapStyle
      isPublished?: boolean
    } | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const existing = await db.style.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Style not found' }, { status: 404 })
    }
    // Build the update payload.
    const data: {
      name?: string
      spec?: string
      version?: number
      centerLng?: number
      centerLat?: number
      zoom?: number
      bearing?: number
      pitch?: number
      isPublished?: boolean
    } = {}
    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim()
    }
    if (typeof body.isPublished === 'boolean') {
      data.isPublished = body.isPublished
    }
    if (body.spec && typeof body.spec === 'object') {
      // Re-derive the entire denormalized view from the new spec.
      Object.assign(data, mapStyleToPrismaData(body.spec, existing.projectId))
    }
    const updated = await db.style.update({ where: { id }, data })
    return NextResponse.json({ style: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/styles/[id]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    await db.style.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
