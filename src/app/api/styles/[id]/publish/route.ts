import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// POST /api/styles/[id]/publish — mark a style as published.
// Returns { publishedAt, url } where `url` is the public export endpoint.
export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await db.style.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Style not found' }, { status: 404 })
    }
    const updated = await db.style.update({
      where: { id },
      data: { isPublished: true },
    })
    return NextResponse.json({
      publishedAt: updated.updatedAt,
      url: `/api/styles/${id}/export`,
      isPublished: true,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
