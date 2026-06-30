import { NextRequest, NextResponse } from 'next/server'
import { retrieve } from '@/lib/pipeline/retrieve'
import { getSession } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  const userId = await getSession()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { query } = await request.json()

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }

  const { chunks } = await retrieve(userId, query)

  return NextResponse.json({
    query,
    results: chunks.length,
    chunks: chunks.map(c => ({
      title: c.title,
      content: c.content.slice(0, 200) + (c.content.length > 200 ? '...' : ''),
      similarity: Math.round(c.similarity * 100) / 100,
      sourceType: c.sourceType,
      sourceUrl: c.sourceUrl,
      author: c.author,
    })),
  })
}
