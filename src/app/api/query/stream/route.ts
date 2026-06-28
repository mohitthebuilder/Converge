import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { retrieve, RetrievedChunk, RetrievalMeta } from '@/lib/pipeline/retrieve'
import { rewriteQuery } from '@/lib/pipeline/rewrite'
import { supabaseServer } from '@/lib/db/supabase-server'
import { getSession } from '@/lib/auth/session'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are Converge, a knowledge assistant for Product Managers. Answer the PM's question using ONLY the provided documents.

<instructions>
<faithfulness>
- Only use information from the provided documents. Never fabricate, infer, or extrapolate beyond what is stated.
- Preserve the source's exact structure, terminology, counts, and categories. If a document says "4 phases", say "**4 phases**" — never reinterpret as 6 sub-items or rename them.
- When the source lists specific items, reproduce that exact list. Do not add, merge, split, or omit items.
- If documents contain conflicting information, present both views with their sources.
- If the documents don't contain the specific data needed, say so explicitly. State what is missing. Do not substitute indirect evidence for a direct answer.
</faithfulness>

<formatting>
- Never use markdown headings (#, ##, ###). Use **bold text** for section labels within flowing prose.
- Use bullet points with - for lists. Align them cleanly.
- Bold key numbers, names, dates, and decisions so they stand out on a quick scan.
- Do not use emojis, horizontal rules, or decorative formatting.
- Do NOT wrap your response in JSON or any structured format.
- Do NOT include inline citation numbers like [1], [2]. Sources are shown separately by the UI.
- Do NOT append a Sources, References, or Citations section. The UI handles this.
</formatting>

<tone>
- Lead with the direct answer in the first sentence. Supporting details follow.
- Match depth to complexity: simple question = one-sentence answer; complex question = thorough breakdown.
- Be concise. Every sentence must add value. No filler, hedging, or repetition.
- Write for a PM audience: decisions first, rationale second, implementation details last.
- Never use technical terms like "chunks", "context", "documents provided", or "data sources". Speak as if you naturally know this from the user's tools.
</tone>

<edge_cases>
- If the query is ambiguous, answer the most likely interpretation and note the ambiguity briefly.
- If only part of the question can be answered, answer that part fully and explicitly state what cannot be answered.
- If documents mention something in passing but don't substantively address it, do not build an answer around passing mentions. That is not answering the question.
- If the user asks about a specific count, date, or name that appears in the documents, quote it exactly. Do not paraphrase numbers or rename entities.
</edge_cases>
</instructions>

<output_format>
After your answer, on a NEW line, output exactly ONE of these tags. This is required and will be stripped from the displayed answer:
<<CONFIDENCE:HIGH>> — your answer directly and fully addresses the question with specific information
<<CONFIDENCE:MEDIUM>> — your answer partially addresses the question but some requested details are missing or uncertain
<<CONFIDENCE:LOW>> — the documents contain only tangentially related information; your answer is a stretch
<<CONFIDENCE:NONE>> — the documents do not contain information relevant to this question at all
</output_format>`

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

function sseEvent(encoder: TextEncoder, data: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function POST(request: NextRequest) {
  const { query } = await request.json()

  if (!query || typeof query !== 'string') {
    return new Response(JSON.stringify({ error: 'Query is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const userId = await getSession()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const start = Date.now()
  const t = (label: string) => console.log(`[TIMING] ${label}: ${Date.now() - start}ms`)

  ;(async () => {
    try {
      // ── Auth scope + rewrite in parallel (auth hidden behind rewrite time) ──
      const [userDocIds, rewrite] = await Promise.all([
        (async () => {
          const { data: conns } = await supabaseServer
            .from('connection')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'active')
          const connIds = conns?.map(c => c.id) || []
          if (connIds.length === 0) return new Set<string>()
          const { data: docs } = await supabaseServer
            .from('document')
            .select('id')
            .in('connection_id', connIds)
          return new Set(docs?.map(d => d.id) || [])
        })(),
        rewriteQuery(query),
      ])
      t('auth-scope+rewrite')

      // ── Retrieval phase ──
      const subResults = await Promise.all(
        rewrite.subQueries.map(subQuery => retrieve(subQuery, 0.2, 10, userDocIds))
      )
      t('retrieval')

      const seenChunkIds = new Set<string>()
      const allChunks: RetrievedChunk[] = []
      let totalReranked = 0
      let totalCandidates = 0

      for (const result of subResults) {
        totalReranked += result.meta.chunksPassedReranker
        totalCandidates += result.meta.totalCandidates
        for (const chunk of result.chunks) {
          if (!seenChunkIds.has(chunk.id)) {
            seenChunkIds.add(chunk.id)
            allChunks.push(chunk)
          }
        }
      }

      allChunks.sort((a, b) => b.similarity - a.similarity)
      const chunks = allChunks
      const retrievalMeta: RetrievalMeta = { chunksPassedReranker: totalReranked, totalCandidates }

      // ── No results ──
      if (chunks.length === 0) {
        let lastSyncNote = ''
        const { data: conn } = await supabaseServer
          .from('connection')
          .select('last_synced_at')
          .eq('user_id', userId)
          .not('last_synced_at', 'is', null)
          .order('last_synced_at', { ascending: false })
          .limit(1)
          .single()
        if (conn?.last_synced_at) {
          const synced = new Date(conn.last_synced_at)
          lastSyncNote = ` Data last synced ${synced.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${synced.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`
        }
        await writer.write(sseEvent(encoder, { type: 'sources', sources: [] }))
        await writer.write(sseEvent(encoder, { type: 'text', content: `No relevant sources found for your question. Try rephrasing, or check that your tools are connected and synced.${lastSyncNote}` }))
        await writer.write(sseEvent(encoder, { type: 'done', latencyMs: 0 }))
        await writer.close()
        return
      }

      // ── Send sources immediately (before LLM starts) ──
      const sourceGroups = groupChunksByDocument(chunks)
      const sources = sourceGroups.map((g) => ({
        index: g.index,
        title: g.title,
        tool: g.sourceType.replace('_', ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
        url: g.sourceUrl,
        similarity: Math.round(g.bestScore * 100) / 100,
      }))

      await writer.write(sseEvent(encoder, { type: 'sources', sources }))
      t('sources sent')

      // ── Model routing: Haiku for high-confidence, Sonnet for complex ──
      const bestScore = Math.max(...chunks.map(c => c.similarity))
      const useHaiku = bestScore >= 0.5 && chunks.length >= 3
      const selectedModel = useHaiku ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6'

      // ── LLM streaming ──
      const contextBlock = formatGroupedPrompt(sourceGroups)
      let fullAnswer = ''
      let firstToken = true

      const retrievalSignal = `<retrieval_quality>\n${retrievalMeta.chunksPassedReranker} chunks passed reranker out of ${retrievalMeta.totalCandidates} candidates. ${chunks.length} total chunks (including adjacent context) from ${sourceGroups.length} sources.\nIf few chunks passed reranker relative to candidates, retrieval confidence is lower — factor this into your confidence tag.\n</retrieval_quality>`

      const stream = anthropic.messages.stream({
        model: selectedModel,
        max_tokens: 1000,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `${retrievalSignal}\n\n<context>\n${contextBlock}\n</context>\n\n<question>\n${query}\n</question>` }],
      })

      stream.on('text', (text) => {
        if (firstToken) { t('first token'); firstToken = false }
        fullAnswer += text
        writer.write(sseEvent(encoder, { type: 'text', content: text }))
      })

      await stream.finalMessage()
      const latencyMs = Date.now() - start
      t('stream done')

      // ── Confidence (tag is stripped client-side by AnswerView) ──
      const confidenceMatch = fullAnswer.match(/<<CONFIDENCE:(HIGH|MEDIUM|LOW|NONE)>>/)
      const llmConfidence = confidenceMatch ? confidenceMatch[1].toLowerCase() : null
      const cleanAnswer = fullAnswer.replace(/\n?<<CONFIDENCE:(HIGH|MEDIUM|LOW|NONE)>>/, '').trimEnd()

      if (llmConfidence === 'none') {
        await writer.write(sseEvent(encoder, { type: 'confidence', level: 'none' }))
      } else if (llmConfidence) {
        await writer.write(sseEvent(encoder, { type: 'confidence', level: llmConfidence, message: '' }))
      }

      // ── Fix 3: Send done event BEFORE DB persist (latency stops here for user) ──
      await writer.write(sseEvent(encoder, { type: 'done', latencyMs }))
      t('done sent')

      // ── Persist to DB (after done event — doesn't inflate latency) ──
      const { data: queryRow } = await supabaseServer
        .from('query')
        .insert({ user_id: userId, original_query: query, rewritten_query: rewrite.subQueries.join(' | '), live_context_on: false })
        .select('id')
        .single()

      if (queryRow) {
        const { data: answerRow } = await supabaseServer
          .from('answer')
          .insert({
            query_id: queryRow.id,
            answer_text: cleanAnswer,
            model_used: selectedModel,
            latency_ms: latencyMs,
          })
          .select('id')
          .single()
        if (answerRow?.id) {
          await writer.write(sseEvent(encoder, { type: 'answer_id', answerId: answerRow.id }))
        }
      }
      t('persist done')
    } catch (err) {
      await writer.write(sseEvent(encoder, { type: 'error', message: String(err) }))
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
