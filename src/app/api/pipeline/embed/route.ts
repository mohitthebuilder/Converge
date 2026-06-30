import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { embedTexts } from '@/lib/pipeline/embed'
import { getSession } from '@/lib/auth/session'

const BATCH_SIZE = 20
const PAGE_LIMIT = 200

interface ChunkDoc {
  title: string | null
  source_type: string
  author: string | null
  doc_type: string | null
  document_date: string | null
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function buildMetadataPrefix(doc: ChunkDoc | null, chunkMeta: Record<string, unknown> | null): string {
  if (!doc) return ''

  const date = formatDate(doc.document_date)
  const st = doc.source_type
  if (st === 'google_drive') {
    const mimeLabel = doc.doc_type?.includes('spreadsheet') ? 'spreadsheet'
      : doc.doc_type?.includes('presentation') ? 'slides'
      : doc.doc_type?.includes('pdf') ? 'pdf'
      : doc.doc_type?.includes('wordprocessingml') ? 'docx'
      : doc.doc_type?.includes('text/plain') ? 'txt'
      : 'document'
    const parts = ['google_drive', mimeLabel, doc.title, doc.author ? `by ${doc.author}` : null, date].filter(Boolean)
    return `[${parts.join(' | ')}] `
  }

  if (st === 'gmail') {
    const recipients = chunkMeta?.recipients as string | undefined
    const msgCount = chunkMeta?.message_count as number | undefined
    const parts = [
      'gmail',
      doc.title ? `subject: ${doc.title}` : null,
      doc.author ? `from ${doc.author}` : null,
      recipients ? `to ${recipients}` : null,
      msgCount ? `thread with ${msgCount} messages` : null,
      date,
    ].filter(Boolean)
    return `[${parts.join(' | ')}] `
  }

  if (st === 'slack') {
    const channel = chunkMeta?.channel as string | undefined
    const username = chunkMeta?.username as string | undefined
    const replyContext = chunkMeta?.reply_context as string | undefined
    const parts = [
      'slack',
      channel ? `#${channel}` : null,
      username ? `@${username}` : null,
      date,
      replyContext || null,
    ].filter(Boolean)
    return `[${parts.join(' | ')}] `
  }

  if (st === 'jira') {
    const parts = [
      'jira',
      chunkMeta?.issue_key as string | undefined,
      chunkMeta?.issue_type as string | undefined,
      chunkMeta?.status as string | undefined,
      chunkMeta?.project as string | undefined,
      chunkMeta?.assignee ? `assignee: ${chunkMeta.assignee}` : null,
      chunkMeta?.priority ? `priority: ${chunkMeta.priority}` : null,
      chunkMeta?.sprint ? `sprint: ${chunkMeta.sprint}` : null,
      date,
    ].filter(Boolean)
    return `[${parts.join(' | ')}] `
  }

  const parts = [doc.source_type, doc.title, doc.author, date].filter(Boolean)
  return parts.length > 0 ? `[${parts.join(' | ')}] ` : ''
}

export async function POST(request: NextRequest) {
  const userId = await getSession()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { connectionId } = await request.json()

  const { data: conn } = await supabaseServer
    .from('connection')
    .select('id')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single()

  if (!conn) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 403 })
  }

  const { data: docs } = await supabaseServer
    .from('document')
    .select('id')
    .eq('connection_id', connectionId)

  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: 'No documents found' }, { status: 404 })
  }

  const docIds = docs.map(d => d.id)

  const ID_BATCH = 100
  const chunks: { id: string; content: string; metadata: Record<string, unknown> | null; document: ChunkDoc | null }[] = []
  for (let i = 0; i < docIds.length; i += ID_BATCH) {
    const batch = docIds.slice(i, i + ID_BATCH)
    const { data, error } = await supabaseServer
      .from('chunk')
      .select('id, content, metadata, document:document_id(title, source_type, author, doc_type, document_date)')
      .in('document_id', batch)
      .is('embedding', null)
      .limit(PAGE_LIMIT)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (data) chunks.push(...(data as unknown as typeof chunks))
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
      const prefix = buildMetadataPrefix(c.document, c.metadata)
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
            const chunkPrefix = buildMetadataPrefix(chunk.document, chunk.metadata)
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
