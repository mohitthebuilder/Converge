import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { embedTexts } from '@/lib/pipeline/embed'

const BATCH_SIZE = 20
const PAGE_LIMIT = 200

export async function POST(request: NextRequest) {
  const { connectionId } = await request.json()

  const { data: docs } = await supabaseServer
    .from('document')
    .select('id')
    .eq('connection_id', connectionId)

  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: 'No documents found' }, { status: 404 })
  }

  const docIds = docs.map(d => d.id)

  const ID_BATCH = 100
  const chunks: { id: string; content: string; document: { title: string | null; source_type: string } | null }[] = []
  for (let i = 0; i < docIds.length; i += ID_BATCH) {
    const batch = docIds.slice(i, i + ID_BATCH)
    const { data, error } = await supabaseServer
      .from('chunk')
      .select('id, content, document:document_id(title, source_type)')
      .in('document_id', batch)
      .is('embedding', null)
      .limit(PAGE_LIMIT)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (data) chunks.push(...data)
    if (chunks.length >= PAGE_LIMIT) break
  }

  const page = chunks.slice(0, PAGE_LIMIT)

  if (page.length === 0) {
    return NextResponse.json({ embedded: 0, total: 0, remaining: 0 })
  }

  let embedded = 0

  for (let i = 0; i < page.length; i += BATCH_SIZE) {
    const batch = page.slice(i, i + BATCH_SIZE)
    const texts = batch.map(c => {
      const doc = c.document
      const prefix = doc?.title ? `[Document: ${doc.title}] ` : ''
      return prefix + c.content
    })

    try {
      const embeddings = await embedTexts(texts)

      if (i > 0) await new Promise(r => setTimeout(r, 2000))

      for (let j = 0; j < batch.length; j++) {
        const { error: updateError } = await supabaseServer
          .from('chunk')
          .update({ embedding: JSON.stringify(embeddings[j]) })
          .eq('id', batch[j].id)

        if (!updateError) embedded++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message.includes('maximum input length')) {
        for (const chunk of batch) {
          try {
            const chunkPrefix = chunk.document?.title ? `[Document: ${chunk.document.title}] ` : ''
            const [embedding] = await embedTexts([chunkPrefix + chunk.content])
            const { error: updateError } = await supabaseServer
              .from('chunk')
              .update({ embedding: JSON.stringify(embedding) })
              .eq('id', chunk.id)
            if (!updateError) embedded++
          } catch {
            console.error(`Chunk ${chunk.id} too large to embed, skipping`)
          }
        }
      } else {
        console.error(`Embed batch ${Math.floor(i / BATCH_SIZE)} failed: ${message}`)
      }
    }
  }

  const hasMore = chunks.length >= PAGE_LIMIT
  return NextResponse.json({ embedded, total: page.length, remaining: hasMore ? '200+' : 0 })
}
