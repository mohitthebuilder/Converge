import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { retrieve, RetrievedChunk } from '@/lib/pipeline/retrieve'
import { supabaseServer } from '@/lib/db/supabase-server'
import { getSession } from '@/lib/auth/session'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are Converge, a knowledge assistant for Product Managers. Answer the PM's question using ONLY the provided context chunks.

Rules:
1. Only use information from the provided chunks. Never fabricate information.
2. Cite every claim inline using numbered references like [1], [2], etc. The number corresponds to the source number.
3. If chunks contain conflicting information, present both views with their citations.
4. If the chunks don't contain the specific data needed to answer the question, say so explicitly. Do not use indirect evidence (team size, confidence levels, general context) as a substitute for the specific data requested. State what data is missing.
5. Structure your answer for a PM audience: lead with the decision/answer, then supporting details.
6. Match answer depth to query complexity. For simple factual lookups (a date, a name, a number), lead with a one-sentence answer. For complex questions, be thorough.
7. Do NOT wrap your response in JSON or any other format. Just write the answer directly.
8. Do not use emojis. Use plain text formatting only.`

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

  const chunks = await retrieve(query)

  if (chunks.length === 0) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'sources', chunks: [] })}\n\n`))
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

  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const start = Date.now()

  ;(async () => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`))

      const contextBlock = formatGroupedPrompt(sourceGroups)
      let fullAnswer = ''

      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Context chunks:\n\n${contextBlock}\n\nQuestion: ${query}` }],
      })

      stream.on('text', async (text) => {
        fullAnswer += text
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`))
      })

      await stream.finalMessage()
      const latencyMs = Date.now() - start

      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done', latencyMs })}\n\n`))

      const userId = await getSession()
      if (userId) {
        const { data: queryRow } = await supabaseServer
          .from('query')
          .insert({ user_id: userId, original_query: query, live_context_on: false })
          .select('id')
          .single()

        if (queryRow) {
          await supabaseServer
            .from('answer')
            .insert({
              query_id: queryRow.id,
              answer_text: fullAnswer,
              model_used: 'claude-sonnet-4-6',
              latency_ms: latencyMs,
            })
        }
      }
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
