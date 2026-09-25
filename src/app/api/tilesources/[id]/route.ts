import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// GET /api/tilesources/[id]
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const tileSource = await db.tileSource.findUnique({ where: { id } })
    if (!tileSource) {
      return NextResponse.json({ error: 'Tile source not found' }, { status: 404 })
    }
    return NextResponse.json({ tileSource })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/tilesources/[id]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    await db.tileSource.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
