import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { normalize } from '@/lib/pipeline/normalize'
import { chunkDocument } from '@/lib/pipeline/chunk'

const DOC_BATCH = 50

export async function POST() {
  const oversizedDocIds = new Set<string>()
  let from = 0
  const PAGE = 1000

  while (true) {
    const { data, error: scanError } = await supabaseServer
      .from('chunk')
      .select('document_id, token_count')
      .gt('token_count', 600)
      .range(from, from + PAGE - 1)

    if (scanError) {
      return NextResponse.json({ error: scanError.message }, { status: 500 })
    }

    if (!data || data.length === 0) break
    for (const row of data) oversizedDocIds.add(row.document_id)
    if (data.length < PAGE) break
    from += PAGE
  }

  if (oversizedDocIds.size === 0) {
    return NextResponse.json({ message: 'No oversized chunks found', rechunked: 0 })
  }

  const allDocIds = [...oversizedDocIds]
  let totalDeleted = 0
  let totalNewChunks = 0
  const results: Array<{ title: string; oldChunks: number; newChunks: number; maxChunkChars: number }> = []

  for (let b = 0; b < allDocIds.length; b += DOC_BATCH) {
    const batchIds = allDocIds.slice(b, b + DOC_BATCH)

    const { data: documents } = await supabaseServer
      .from('document')
      .select('id, content, doc_type, title, source_type, author, indexed_at')
      .in('id', batchIds)

    if (!documents) continue

    for (const doc of documents) {
      const { count: oldCount } = await supabaseServer
        .from('chunk')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', doc.id)

      const { error: delError } = await supabaseServer
        .from('chunk')
        .delete()
        .eq('document_id', doc.id)

      if (delError) continue

      totalDeleted += oldCount || 0

      const cleaned = normalize(doc.content, doc.doc_type)
      if (!cleaned) continue

      const chunks = chunkDocument(cleaned, doc.doc_type)
      if (chunks.length === 0) continue

      const baseMeta: Record<string, unknown> = {
        title: doc.title,
        doc_type: doc.doc_type,
        source_type: doc.source_type,
        author: doc.author,
      }

      const chunkRows = chunks.map(c => ({
        document_id: doc.id,
        content: c.content,
        chunk_index: c.chunkIndex,
        token_count: c.tokenCount,
        metadata: c.tableMeta ? { ...baseMeta, ...c.tableMeta } : baseMeta,
      }))

      const { error: insertError } = await supabaseServer
        .from('chunk')
        .insert(chunkRows)

      if (!insertError) {
        const maxLen = Math.max(...chunks.map(c => c.content.length))
        totalNewChunks += chunks.length
        results.push({
          title: doc.title || 'Unknown',
          oldChunks: oldCount || 0,
          newChunks: chunks.length,
          maxChunkChars: maxLen,
        })
      }
    }
  }

  return NextResponse.json({
    documentsRechunked: results.length,
    totalDeleted,
    totalNewChunks,
    results: results.slice(0, 50),
    totalResultCount: results.length,
  })
}
