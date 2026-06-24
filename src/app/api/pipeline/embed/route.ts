import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { embedTexts } from '@/lib/pipeline/embed'

const BATCH_SIZE = 20

export async function POST(request: NextRequest) {
  const { connectionId } = await request.json()

  // Get document IDs for this connection
  const { data: docs } = await supabaseServer
    .from('document')
    .select('id')
    .eq('connection_id', connectionId)

  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: 'No documents found' }, { status: 404 })
  }

  const docIds = docs.map(d => d.id)

  // Get chunks without embeddings
  const { data: chunks, error } = await supabaseServer
    .from('chunk')
    .select('id, content')
    .in('document_id', docIds)
    .is('embedding', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!chunks || chunks.length === 0) {
    return NextResponse.json({ embedded: 0, message: 'All chunks already have embeddings' })
  }

  let embedded = 0

  // Process in batches
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const texts = batch.map(c => c.content)

    try {
      const embeddings = await embedTexts(texts)

      // Rate limit: wait between batches to stay under 40K tokens/min
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
      return NextResponse.json({ embedded, error: message, failedAtBatch: Math.floor(i / BATCH_SIZE) }, { status: 500 })
    }
  }

  return NextResponse.json({ embedded, total: chunks.length })
}
