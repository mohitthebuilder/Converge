import { NextRequest, NextResponse } from 'next/server'
import { retrieve } from '@/lib/pipeline/retrieve'
import { synthesize } from '@/lib/llm/synthesize'
import { supabaseServer } from '@/lib/db/supabase-server'

export async function POST(request: NextRequest) {
  const { query } = await request.json()

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }

  const chunks = await retrieve(query)

  if (chunks.length === 0) {
    return NextResponse.json({
      query,
      answer: 'No relevant sources found for your question. Try rephrasing, or check that your tools are connected and synced.',
      citations: [],
      confidence: 'low',
      chunksUsed: 0,
    })
  }

  const result = await synthesize(query, chunks)

  // Store query, answer, and citations in DB
  const { data: user } = await supabaseServer
    .from('users')
    .select('id')
    .limit(1)
    .single()

  if (user) {
    const { data: queryRow } = await supabaseServer
      .from('query')
      .insert({
        user_id: user.id,
        original_query: query,
        live_context_on: false,
      })
      .select('id')
      .single()

    if (queryRow) {
      const { data: answerRow } = await supabaseServer
        .from('answer')
        .insert({
          query_id: queryRow.id,
          answer_text: result.answerText,
          model_used: result.modelUsed,
          latency_ms: result.latencyMs,
        })
        .select('id')
        .single()

      if (answerRow && result.citations.length > 0) {
        const citationRows = result.citations.map(c => ({
          answer_id: answerRow.id,
          chunk_id: c.chunkId,
          relevance_score: chunks.find(ch => ch.id === c.chunkId)?.similarity || 0,
        }))

        await supabaseServer.from('citation').insert(citationRows)
      }
    }
  }

  return NextResponse.json({
    query,
    answer: result.answerText,
    citations: result.citations.map(c => ({
      title: c.sourceTitle,
      tool: c.sourceTool,
      url: c.sourceUrl,
    })),
    confidence: result.confidence,
    chunksUsed: chunks.length,
    latencyMs: result.latencyMs,
    model: result.modelUsed,
  })
}
