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
  chunkIndex?: number
}

const RRF_K = 60
const CANDIDATE_COUNT = 30
const RERANK_THRESHOLD = 0.3
const MAX_CHUNKS = 10

function rrfMerge(
  semanticChunks: Array<{ id: string; content: string; document_id: string; similarity: number; chunk_index?: number }>,
  bm25Chunks: Array<{ id: string; content: string; document_id: string; rank: number; chunk_index?: number }>,
  topK: number
): Array<{ id: string; content: string; document_id: string; score: number; chunk_index?: number }> {
  const scores = new Map<string, number>()
  const chunkData = new Map<string, { id: string; content: string; document_id: string; chunk_index?: number }>()

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

async function rerank(
  query: string,
  chunks: Array<{ id: string; content: string; document_id: string; score: number; chunk_index?: number }>
): Promise<Array<{ id: string; content: string; document_id: string; score: number; chunk_index?: number }>> {
  const apiKey = process.env.COHERE_API_KEY
  if (!apiKey || chunks.length === 0) return chunks

  try {
    const response = await fetch('https://api.cohere.com/v2/rerank', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'rerank-v3.5',
        query,
        documents: chunks.map(c => c.content),
        top_n: MAX_CHUNKS,
      }),
    })

    if (!response.ok) {
      console.error(`Cohere rerank failed: ${response.status}`)
      return chunks
    }

    const data = await response.json()
    return data.results
      .filter((r: { relevance_score: number }) => r.relevance_score >= RERANK_THRESHOLD)
      .map((r: { index: number; relevance_score: number }) => ({
        ...chunks[r.index],
        score: r.relevance_score,
      }))
  } catch (err) {
    console.error('Cohere rerank error:', err)
    return chunks
  }
}

async function fetchAdjacentChunks(
  matchedChunks: Array<{ id: string; document_id: string; chunk_index?: number }>,
): Promise<Array<{ id: string; content: string; document_id: string; chunk_index: number }>> {
  const adjacentQueries: Array<{ docId: string; indices: number[] }> = []
  const matchedIds = new Set(matchedChunks.map(c => c.id))

  for (const chunk of matchedChunks) {
    if (chunk.chunk_index == null) continue
    adjacentQueries.push({
      docId: chunk.document_id,
      indices: [chunk.chunk_index - 1, chunk.chunk_index + 1].filter(i => i >= 0),
    })
  }

  if (adjacentQueries.length === 0) return []

  const allIndices = new Map<string, Set<number>>()
  for (const q of adjacentQueries) {
    const existing = allIndices.get(q.docId) || new Set()
    q.indices.forEach(i => existing.add(i))
    allIndices.set(q.docId, existing)
  }

  const results: Array<{ id: string; content: string; document_id: string; chunk_index: number }> = []

  for (const [docId, indices] of allIndices) {
    const { data } = await supabaseServer
      .from('chunk')
      .select('id, content, document_id, chunk_index')
      .eq('document_id', docId)
      .in('chunk_index', [...indices])

    if (data) {
      for (const row of data) {
        if (!matchedIds.has(row.id)) {
          results.push(row)
          matchedIds.add(row.id)
        }
      }
    }
  }

  return results
}

export async function retrieve(
  query: string,
  threshold = 0.2,
  topK = MAX_CHUNKS
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

  const merged = rrfMerge(semanticChunks, bm25Chunks, CANDIDATE_COUNT)

  const reranked = await rerank(query, merged)

  const adjacent = await fetchAdjacentChunks(reranked)

  const allChunks = [...reranked]
  for (const adj of adjacent) {
    if (!allChunks.find(c => c.id === adj.id)) {
      allChunks.push({ ...adj, score: 0 })
    }
  }

  allChunks.sort((a, b) => {
    if (a.document_id === b.document_id && a.chunk_index != null && b.chunk_index != null) {
      return a.chunk_index - b.chunk_index
    }
    return b.score - a.score
  })

  const documentIds = [...new Set(allChunks.map(c => c.document_id))]
  const { data: documents } = await supabaseServer
    .from('document')
    .select('id, title, source_url, source_type, author')
    .in('id', documentIds)

  const docMap = new Map(documents?.map(d => [d.id, d]) || [])

  return allChunks.map(chunk => {
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
      chunkIndex: chunk.chunk_index,
    }
  })
}
