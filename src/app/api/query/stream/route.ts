import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { retrieve, RetrievedChunk } from '@/lib/pipeline/retrieve'
import { rewriteQuery } from '@/lib/pipeline/rewrite'
import { validateRetrieval } from '@/lib/pipeline/validate'
import { supabaseServer } from '@/lib/db/supabase-server'
import { getSession } from '@/lib/auth/session'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are Converge, a knowledge assistant for Product Managers. Answer the PM's question using ONLY the provided documents.

Rules:
1. Only use information from the provided documents. Never fabricate information.
2. Do NOT include inline citation numbers like [1], [2] in your answer. Sources are shown separately below your answer.
3. If documents contain conflicting information, present both views.
4. If your documents don't contain the specific data needed, say so explicitly. Do not use indirect evidence as a substitute. State what data is missing.
5. Structure your answer for a PM audience: lead with the decision/answer, then supporting details.
6. Match answer depth to query complexity. For simple factual lookups, lead with a one-sentence answer. For complex questions, be thorough.
7. Always use bullet points (•) for lists, never dashes (-). Keep formatting consistent.
8. Do NOT wrap your response in JSON or any other format. Write the answer directly.
9. Do not use emojis. Use plain text formatting only.
10. Never use technical terms like "chunks", "context", "documents provided", or "data sources". Speak naturally as if you know this information from the user's connected tools.`

const MAX_RETRIES = 2

interface SourceGroup {
  index: number
  title: string
  sourceType: string
  sourceUrl: string
  bestScore: number
  chunks: RetrievedChunk[]
}

function groupChunksByDocument(chunks: RetrievedChunk[]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>()
  let nextIndex = 1

  for (const chunk of chunks) {
    const existing = groups.get(chunk.documentId)
    if (existing) {
      existing.chunks.push(chunk)
      if (chunk.similarity > existing.bestScore) {
        existing.bestScore = chunk.similarity
      }
    } else {
      groups.set(chunk.documentId, {
        index: nextIndex++,
        title: chunk.title,
        sourceType: chunk.sourceType,
        sourceUrl: chunk.sourceUrl,
        bestScore: chunk.similarity,
        chunks: [chunk],
      })
    }
  }

  return [...groups.values()]
}

function formatGroupedPrompt(groups: SourceGroup[]): string {
  return groups
    .map((g) => {
      const tool = g.sourceType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
      const chunkText = g.chunks.map(c => c.content).join('\n\n')
      return `--- [${g.index}] ${g.title} — ${tool} (score: ${g.bestScore.toFixed(2)}) ---\n${chunkText}`
    })
    .join('\n\n')
}

export async function POST(request: NextRequest) {
  const { query } = await request.json()

  if (!query || typeof query !== 'string') {
    return new Response(JSON.stringify({ error: 'Query is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let chunks: RetrievedChunk[] = []
  let retryCount = 0
  let validation
  let finalRewrite

  do {
    const retryHint = retryCount > 0
      ? `Previous search found ${chunks.length === 0 ? 'no' : 'only low-relevance'} results. Try alternative phrasings, synonyms, broader terms, or different angles on the same question.`
      : undefined

    const rewrite = await rewriteQuery(query, retryHint)
    finalRewrite = rewrite

    const allChunks: RetrievedChunk[] = []
    const seenChunkIds = new Set<string>()

    for (const subQuery of rewrite.subQueries) {
      const subChunks = await retrieve(subQuery)
      for (const chunk of subChunks) {
        if (!seenChunkIds.has(chunk.id)) {
          seenChunkIds.add(chunk.id)
          allChunks.push(chunk)
        }
      }
    }

    allChunks.sort((a, b) => b.similarity - a.similarity)
    chunks = allChunks
    validation = validateRetrieval(chunks, retryCount)
    retryCount++
  } while (validation.needsRetry && retryCount <= MAX_RETRIES)

  const encoder = new TextEncoder()

  if (chunks.length === 0) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources: [] })}\n\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: 'No relevant sources found for your question. Try rephrasing, or check that your tools are connected and synced.' })}\n\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', latencyMs: 0 })}\n\n`))
        controller.close()
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  }

  const sourceGroups = groupChunksByDocument(chunks)

  const sources = sourceGroups.map((g) => ({
    index: g.index,
    title: g.title,
    tool: g.sourceType.replace('_', ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
    url: g.sourceUrl,
    similarity: Math.round(g.bestScore * 100) / 100,
  }))

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const start = Date.now()

  ;(async () => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`))
      if (validation.confidence !== 'very_low') {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'confidence', level: validation.confidence, message: validation.message })}\n\n`))
      }

      const contextBlock = formatGroupedPrompt(sourceGroups)
      let fullAnswer = ''

      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Context chunks:\n\n${contextBlock}\n\nQuestion: ${query}` }],
      })

      stream.on('text', async (text) => {
        fullAnswer += text
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`))
      })

      await stream.finalMessage()
      const latencyMs = Date.now() - start

      let answerId: string | null = null
      const userId = await getSession()
      if (userId) {
        const { data: queryRow } = await supabaseServer
          .from('query')
          .insert({ user_id: userId, original_query: query, rewritten_query: finalRewrite!.subQueries.join(' | '), live_context_on: false })
          .select('id')
          .single()

        if (queryRow) {
          const { data: answerRow } = await supabaseServer
            .from('answer')
            .insert({
              query_id: queryRow.id,
              answer_text: fullAnswer,
              model_used: 'claude-sonnet-4-6',
              latency_ms: latencyMs,
            })
            .select('id')
            .single()
          answerId = answerRow?.id || null
        }
      }

      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done', latencyMs, answerId })}\n\n`))
    } catch (err) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`))
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
