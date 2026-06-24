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

export async function retrieve(
  query: string,
  threshold = 0.3,
  topK = 8
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(query)

  const { data: chunks, error } = await supabaseServer.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: topK,
  })

  if (error) {
    console.error('match_chunks error:', error)
    return []
  }
  if (!chunks || chunks.length === 0) {
    return []
  }

  const documentIds = [...new Set(chunks.map((c: { document_id: string }) => c.document_id))]
  const { data: documents } = await supabaseServer
    .from('document')
    .select('id, title, source_url, source_type, author')
    .in('id', documentIds)

  const docMap = new Map(documents?.map(d => [d.id, d]) || [])

  return chunks.map((chunk: { id: string; content: string; similarity: number; document_id: string }) => {
    const doc = docMap.get(chunk.document_id)
    return {
      id: chunk.id,
      documentId: chunk.document_id,
      content: chunk.content,
      similarity: chunk.similarity,
      title: doc?.title || 'Unknown',
      sourceUrl: doc?.source_url || '',
      sourceType: doc?.source_type || '',
      author: doc?.author || null,
    }
  })
}
