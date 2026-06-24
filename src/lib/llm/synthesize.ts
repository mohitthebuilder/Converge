import Anthropic from '@anthropic-ai/sdk'
import { RetrievedChunk } from '@/lib/pipeline/retrieve'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are Converge, a knowledge assistant for Product Managers. Answer the PM's question using ONLY the provided context chunks.

Rules:
1. Only use information from the provided chunks. Never fabricate information.
2. Cite every claim inline using this exact format: [Source: {title} — {tool}]
3. If chunks contain conflicting information, present both views with their citations.
4. If the chunks are insufficient to fully answer the question, say so explicitly — never guess.
5. Structure your answer for a PM audience: lead with the decision/answer, then supporting details (owners, timelines, context).
6. Be concise. No filler phrases like "Based on the provided context" or "According to the documents."

Respond with a JSON object in this exact format:
{
  "answer_text": "Your answer with inline [Source: title — tool] citations",
  "citations": [
    {"chunk_id": "id", "source_title": "title", "source_tool": "tool", "source_url": "url"}
  ],
  "confidence": "high" | "medium" | "low"
}

Confidence guide:
- high: multiple chunks clearly answer the question
- medium: partial answer or single source
- low: chunks are tangentially relevant at best`

function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const tool = chunk.sourceType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
      return `--- Chunk ${i + 1} (score: ${chunk.similarity.toFixed(2)}) ---
Source: ${chunk.title} — ${tool}
URL: ${chunk.sourceUrl}
Chunk ID: ${chunk.id}

${chunk.content}`
    })
    .join('\n\n')
}

export interface SynthesisResult {
  answerText: string
  citations: { chunkId: string; sourceTitle: string; sourceTool: string; sourceUrl: string }[]
  confidence: 'high' | 'medium' | 'low'
  modelUsed: string
  latencyMs: number
}

export async function synthesize(
  query: string,
  chunks: RetrievedChunk[]
): Promise<SynthesisResult> {
  const model = 'claude-sonnet-4-6'
  const start = Date.now()

  const contextBlock = formatChunksForPrompt(chunks)

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Context chunks:\n\n${contextBlock}\n\nQuestion: ${query}`,
      },
    ],
  })

  const latencyMs = Date.now() - start
  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      answerText: rawText,
      citations: [],
      confidence: 'low',
      modelUsed: model,
      latencyMs,
    }
  }

  const parsed = JSON.parse(jsonMatch[0])

  return {
    answerText: parsed.answer_text || rawText,
    citations: (parsed.citations || []).map((c: { chunk_id: string; source_title: string; source_tool: string; source_url: string }) => ({
      chunkId: c.chunk_id,
      sourceTitle: c.source_title,
      sourceTool: c.source_tool,
      sourceUrl: c.source_url,
    })),
    confidence: parsed.confidence || 'low',
    modelUsed: model,
    latencyMs,
  }
}
