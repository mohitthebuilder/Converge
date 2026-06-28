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
  if (!apiKey || chunks.length === 0 || chunks.length <= 5) return chunks

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
  const matchedIds = new Set(matchedChunks.map(c => c.id))

  const allIndices = new Map<string, Set<number>>()
  for (const chunk of matchedChunks) {
    if (chunk.chunk_index == null) continue
    const existing = allIndices.get(chunk.document_id) || new Set()
    ;[chunk.chunk_index - 1, chunk.chunk_index + 1].filter(i => i >= 0).forEach(i => existing.add(i))
    allIndices.set(chunk.document_id, existing)
  }

  if (allIndices.size === 0) return []

  const queryResults = await Promise.all(
    [...allIndices.entries()].map(([docId, indices]) =>
      supabaseServer
        .from('chunk')
        .select('id, content, document_id, chunk_index')
        .eq('document_id', docId)
        .in('chunk_index', [...indices])
    )
  )

  const results: Array<{ id: string; content: string; document_id: string; chunk_index: number }> = []
  for (const { data } of queryResults) {
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

export interface RetrievalMeta {
  chunksPassedReranker: number
  totalCandidates: number
}

export async function retrieve(
  query: string,
  threshold = 0.2,
  topK = MAX_CHUNKS,
  filterDocIds?: Set<string>,
  precomputedEmbedding?: number[]
): Promise<{ chunks: RetrievedChunk[]; meta: RetrievalMeta }> {
  const t0 = Date.now()

  const queryEmbedding = precomputedEmbedding || await embedQuery(query)
  console.log(`[TIMING] embed: ${Date.now() - t0}ms${precomputedEmbedding ? ' (precomputed)' : ''}`)

  const t1 = Date.now()
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
  console.log(`[TIMING] search: ${Date.now() - t1}ms`)

  let semanticChunks = semanticResult.data || []
  let bm25Chunks = bm25Result.error ? [] : (bm25Result.data || [])
  if (semanticResult.error) console.log(`[DIAG] semantic search error: ${JSON.stringify(semanticResult.error)}`)
  if (bm25Result.error) console.log(`[DIAG] bm25 search error: ${JSON.stringify(bm25Result.error)}`)
  console.log(`[DIAG] pre-filter: semantic=${semanticChunks.length}, bm25=${bm25Chunks.length}, filterDocIds=${filterDocIds?.size ?? 'none'}`)

  if (filterDocIds && filterDocIds.size > 0) {
    const preSemantic = semanticChunks.length
    const preBm25 = bm25Chunks.length
    semanticChunks = semanticChunks.filter((c: { document_id: string }) => filterDocIds.has(c.document_id))
    bm25Chunks = bm25Chunks.filter((c: { document_id: string }) => filterDocIds.has(c.document_id))
    console.log(`[DIAG] post-filter: semantic=${semanticChunks.length}/${preSemantic}, bm25=${bm25Chunks.length}/${preBm25}`)
  }

  if (semanticChunks.length === 0 && bm25Chunks.length === 0) {
    console.log(`[DIAG] 0 results after filter — returning empty`)
    return { chunks: [], meta: { chunksPassedReranker: 0, totalCandidates: 0 } }
  }

  const merged = rrfMerge(semanticChunks, bm25Chunks, CANDIDATE_COUNT)

  const t2 = Date.now()
  const reranked = await rerank(query, merged)
  console.log(`[TIMING] rerank: ${Date.now() - t2}ms (${merged.length} candidates → ${reranked.length} passed)`)
  const chunksPassedReranker = reranked.length

  const t3 = Date.now()
  const documentIds = [...new Set(reranked.map(c => c.document_id))]
  const [adjacent, docQueryResult] = await Promise.all([
    fetchAdjacentChunks(reranked),
    supabaseServer
      .from('document')
      .select('id, title, source_url, source_type, author')
      .in('id', documentIds),
  ])
  console.log(`[TIMING] adjacent+docs: ${Date.now() - t3}ms`)

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

  const docMap = new Map(docQueryResult.data?.map(d => [d.id, d]) || [])

  const results = allChunks.map(chunk => {
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

  console.log(`[TIMING] retrieve total: ${Date.now() - t0}ms (${results.length} chunks)`)

  return {
    chunks: results,
    meta: { chunksPassedReranker, totalCandidates: merged.length },
  }
}
