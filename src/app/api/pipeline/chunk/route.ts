import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { normalize } from '@/lib/pipeline/normalize'
import { chunkDocument } from '@/lib/pipeline/chunk'

export async function POST(request: NextRequest) {
  const { connectionId } = await request.json()

  // Get all documents for this connection that haven't been chunked yet
  const { data: documents, error } = await supabaseServer
    .from('document')
    .select('id, content, doc_type, title')
    .eq('connection_id', connectionId)
    .not('content', 'is', null)

  if (error || !documents) {
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }

  let totalChunks = 0
  let processedDocs = 0

  for (const doc of documents) {
    // Skip if already chunked
    const { count } = await supabaseServer
      .from('chunk')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', doc.id)

    if (count && count > 0) continue

    // Normalize
    const cleaned = normalize(doc.content, doc.doc_type)
    if (!cleaned) continue

    // Chunk
    const chunks = chunkDocument(cleaned, doc.doc_type)
    if (chunks.length === 0) continue

    // Store chunks
    const chunkRows = chunks.map(c => ({
      document_id: doc.id,
      content: c.content,
      chunk_index: c.chunkIndex,
      token_count: c.tokenCount,
      metadata: { title: doc.title, doc_type: doc.doc_type },
    }))

    const { error: insertError } = await supabaseServer
      .from('chunk')
      .insert(chunkRows)

    if (!insertError) {
      totalChunks += chunks.length
      processedDocs++
    }
  }

  return NextResponse.json({
    processedDocs,
    totalChunks,
    skippedDocs: documents.length - processedDocs,
  })
}
