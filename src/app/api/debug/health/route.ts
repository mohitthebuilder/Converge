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
      rewrite.subQueries.map(sq => retrieve(sq, 0.2, 10, userDocIds))
    )
    const t3 = Date.now()

    const allChunks = results.flatMap(r => r.chunks)

    const resultsNoFilter = await Promise.all(
      rewrite.subQueries.map(sq => retrieve(sq, 0.2, 10))
    )
    const allChunksNoFilter = resultsNoFilter.flatMap(r => r.chunks)

    return NextResponse.json({
      timing: { rewrite: t1 - t0, authScope: t2 - t1, retrieve: t3 - t2, total: t3 - t0 },
      rewrite: rewrite.subQueries,
      authScope: { connections: connIds.length, documents: userDocIds.size },
      withFilter: { chunks: allChunks.length, titles: [...new Set(allChunks.map(c => c.title))].slice(0, 5) },
      withoutFilter: { chunks: allChunksNoFilter.length, titles: [...new Set(allChunksNoFilter.map(c => c.title))].slice(0, 5) },
    })
  }

  const chunkSearch = request.nextUrl.searchParams.get('chunk_content')
  if (chunkSearch) {
    const { data: chunks } = await supabaseServer
      .from('chunk')
      .select('id, content, document_id, chunk_index')
      .ilike('content', `%${chunkSearch}%`)
      .limit(20)
    const docIds = [...new Set(chunks?.map(c => c.document_id) || [])]
    const { data: docs } = docIds.length > 0
      ? await supabaseServer.from('document').select('id, title, source_type').in('id', docIds)
      : { data: [] }
    const docMap = new Map(docs?.map(d => [d.id, d]) || [])
    return NextResponse.json({
      total: chunks?.length || 0,
      chunks: chunks?.map(c => {
        const doc = docMap.get(c.document_id)
        return {
          docTitle: doc?.title, sourceType: doc?.source_type,
          chunkIndex: c.chunk_index,
          content: c.content?.slice(0, 500),
        }
      }) || [],
    })
  }

  const search = request.nextUrl.searchParams.get('search')

  if (search) {
    const { data: docs } = await supabaseServer
      .from('document')
      .select('id, title, doc_type, source_type, connection_id')
      .ilike('title', `%${search}%`)
      .limit(20)

    const docDetails = await Promise.all((docs || []).map(async (doc) => {
      const { data: chunks } = await supabaseServer
        .from('chunk')
        .select('id, chunk_index, content, embedding')
        .eq('document_id', doc.id)
        .order('chunk_index')
        .limit(50)
      return {
        ...doc,
        chunkCount: chunks?.length || 0,
        embeddedCount: chunks?.filter(c => c.embedding !== null).length || 0,
        chunkPreviews: chunks?.map(c => ({
          index: c.chunk_index,
          hasEmbedding: c.embedding !== null,
          preview: c.content?.slice(0, 120),
        })) || [],
      }
    }))

    return NextResponse.json({ results: docDetails })
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
