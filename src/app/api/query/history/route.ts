import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { getSession } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  const userId = await getSession()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const queryId = request.nextUrl.searchParams.get('id')
  if (!queryId) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { data: queryRow } = await supabaseServer
    .from('query')
    .select('id, original_query, created_at')
    .eq('id', queryId)
    .eq('user_id', userId)
    .single()

  if (!queryRow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: answer } = await supabaseServer
    .from('answer')
    .select('id, answer_text, latency_ms')
    .eq('query_id', queryId)
    .single()

  let sources: { index: number; title: string; tool: string; url: string; similarity: number }[] = []
  if (answer) {
    const { data: citations } = await supabaseServer
      .from('citation')
      .select('relevance_score, chunk:chunk_id(id, document_id, content, metadata)')
      .eq('answer_id', answer.id)

    if (citations) {
      const docIds = [...new Set(citations.map((c: Record<string, unknown>) => {
        const chunk = c.chunk as Record<string, unknown>
        return chunk?.document_id as string
      }).filter(Boolean))]

      if (docIds.length > 0) {
        const { data: docs } = await supabaseServer
          .from('document')
          .select('id, title, source_type, source_url')
          .in('id', docIds)

        if (docs) {
          sources = docs.map((d, i) => ({
            index: i + 1,
            title: d.title,
            tool: d.source_type.replace('_', ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
            url: d.source_url,
            similarity: 0,
          }))
        }
      }
    }
  }

  return NextResponse.json({
    query: queryRow.original_query,
    answer: answer?.answer_text || '',
    answerId: answer?.id || null,
    latencyMs: answer?.latency_ms || 0,
    sources,
  })
}

export async function DELETE(request: NextRequest) {
  const userId = await getSession()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const queryId = request.nextUrl.searchParams.get('id')
  if (!queryId) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { data: queryRow } = await supabaseServer
    .from('query')
    .select('id')
    .eq('id', queryId)
    .eq('user_id', userId)
    .single()

  if (!queryRow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: answers } = await supabaseServer
    .from('answer')
    .select('id')
    .eq('query_id', queryId)

  if (answers) {
    for (const a of answers) {
      await supabaseServer.from('feedback').delete().eq('answer_id', a.id)
      await supabaseServer.from('citation').delete().eq('answer_id', a.id)
    }
    await supabaseServer.from('answer').delete().eq('query_id', queryId)
  }

  await supabaseServer.from('query').delete().eq('id', queryId)

  return NextResponse.json({ success: true })
}
