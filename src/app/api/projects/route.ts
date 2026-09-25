import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/projects
// List all projects with counts of styles / datasets / tileSources.
export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            styles: true,
            datasets: true,
            tileSources: true,
          },
        },
      },
    })
    return NextResponse.json({ projects })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/projects
// Body: { name: string, description?: string }
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      name?: string
      description?: string
    } | null
    if (!body || !body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json(
        { error: 'A non-empty `name` is required' },
        { status: 400 },
      )
    }
    const project = await db.project.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
      },
    })
    return NextResponse.json({ project }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
