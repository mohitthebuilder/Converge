import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { retrieve } from '@/lib/pipeline/retrieve'
import { rewriteQuery } from '@/lib/pipeline/rewrite'
import { embedQuery } from '@/lib/pipeline/embed'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')

  if (q) {
    const t0 = Date.now()
    const rewrite = await rewriteQuery(q)
    const t1 = Date.now()

    const userId = '9c353f6e-e66b-48cf-ad61-2b7bf6889863'
    const { data: conns } = await supabaseServer.from('connection').select('id').eq('user_id', userId).eq('status', 'active')
    const connIds = conns?.map(c => c.id) || []
    const { data: docs } = connIds.length > 0
      ? await supabaseServer.from('document').select('id').in('connection_id', connIds)
      : { data: [] }
    const userDocIds = new Set(docs?.map(d => d.id) || [])
    const t2 = Date.now()

    const results = await Promise.all(
      rewrite.subQueries.map(sq => retrieve(userId, sq, 0.2, 10))
    )
    const t3 = Date.now()

    const allChunks = results.flatMap(r => r.chunks)

    return NextResponse.json({
      timing: { rewrite: t1 - t0, authScope: t2 - t1, retrieve: t3 - t2, total: t3 - t0 },
      rewrite: rewrite.subQueries,
      authScope: { connections: connIds.length, documents: userDocIds.size },
      results: { chunks: allChunks.length, titles: [...new Set(allChunks.map(c => c.title))].slice(0, 5) },
    })
  }

  const [chunks, embeddedChunks, docs, connections] = await Promise.all([
    supabaseServer.from('chunk').select('id', { count: 'exact', head: true }),
    supabaseServer.from('chunk').select('id', { count: 'exact', head: true }).not('embedding', 'is', null),
    supabaseServer.from('document').select('id', { count: 'exact', head: true }),
    supabaseServer.from('connection').select('id, user_id, source_type, status, last_synced_at'),
  ])

  return NextResponse.json({
    totalChunks: chunks.count,
    embeddedChunks: embeddedChunks.count,
    totalDocs: docs.count,
    connections: connections.data,
  })
}
