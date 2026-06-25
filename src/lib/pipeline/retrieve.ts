import { supabaseServer } from '@/lib/db/supabase-server'
import { embedQuery } from '@/lib/pipeline/embed'

export interface RetrievedChunk {
  id: string
  documentId: string
  content: string
  similarity: number
  title: string
  sourceUrl: string
  sourceType: string
  author: string | null
}

const RRF_K = 60
const CANDIDATE_COUNT = 20

function rrfMerge(
  semanticChunks: Array<{ id: string; content: string; document_id: string; similarity: number }>,
  bm25Chunks: Array<{ id: string; content: string; document_id: string; rank: number }>,
  topK: number
): Array<{ id: string; content: string; document_id: string; score: number }> {
  const scores = new Map<string, number>()
  const chunkData = new Map<string, { id: string; content: string; document_id: string }>()

  for (let i = 0; i < semanticChunks.length; i++) {
    const c = semanticChunks[i]
    scores.set(c.id, (scores.get(c.id) || 0) + 1 / (RRF_K + i + 1))
    chunkData.set(c.id, c)
  }

  for (let i = 0; i < bm25Chunks.length; i++) {
    const c = bm25Chunks[i]
    scores.set(c.id, (scores.get(c.id) || 0) + 1 / (RRF_K + i + 1))
    if (!chunkData.has(c.id)) chunkData.set(c.id, c)
  }

  const maxRrf = 2 / (RRF_K + 1)
  return [...scores.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, topK)
    .map(([id, rawScore]) => ({
      ...chunkData.get(id)!,
      score: rawScore / maxRrf,
    }))
}

export async function retrieve(
  query: string,
  threshold = 0.3,
  topK = 5
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(query)

  const [semanticResult, bm25Result] = await Promise.all([
    supabaseServer.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: CANDIDATE_COUNT,
    }),
    supabaseServer.rpc('match_chunks_bm25', {
      query_text: query,
      match_count: CANDIDATE_COUNT,
    }),
  ])

  const semanticChunks = semanticResult.data || []
  const bm25Chunks = bm25Result.error ? [] : (bm25Result.data || [])

  if (semanticChunks.length === 0 && bm25Chunks.length === 0) return []

  const merged = rrfMerge(semanticChunks, bm25Chunks, topK)

  const documentIds = [...new Set(merged.map(c => c.document_id))]
  const { data: documents } = await supabaseServer
    .from('document')
    .select('id, title, source_url, source_type, author')
    .in('id', documentIds)

  const docMap = new Map(documents?.map(d => [d.id, d]) || [])

  return merged.map(chunk => {
    const doc = docMap.get(chunk.document_id)
    return {
      id: chunk.id,
      documentId: chunk.document_id,
      content: chunk.content,
      similarity: Math.round(chunk.score * 100) / 100,
      title: doc?.title || 'Unknown',
      sourceUrl: doc?.source_url || '',
      sourceType: doc?.source_type || '',
      author: doc?.author || null,
    }
  })
}
