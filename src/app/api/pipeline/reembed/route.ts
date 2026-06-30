import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { embedTexts } from '@/lib/pipeline/embed'
import { getSession } from '@/lib/auth/session'

const EMBED_BATCH = 20
const PER_REQUEST = 50
const ID_BATCH = 100

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
      'gmail', doc.title ? `subject: ${doc.title}` : null, doc.author ? `from ${doc.author}` : null,
      recipients ? `to ${recipients}` : null, msgCount ? `thread with ${msgCount} messages` : null, date,
    ].filter(Boolean)
    return `[${parts.join(' | ')}] `
  }

  if (st === 'slack') {
    const channel = chunkMeta?.channel as string | undefined
    const username = chunkMeta?.username as string | undefined
    const replyContext = chunkMeta?.reply_context as string | undefined
    const parts = ['slack', channel ? `#${channel}` : null, username ? `@${username}` : null, date, replyContext || null].filter(Boolean)
    return `[${parts.join(' | ')}] `
  }

  if (st === 'jira') {
    const parts = [
      'jira', chunkMeta?.issue_key as string | undefined, chunkMeta?.issue_type as string | undefined,
      chunkMeta?.status as string | undefined, chunkMeta?.project as string | undefined,
      chunkMeta?.assignee ? `assignee: ${chunkMeta.assignee}` : null,
      chunkMeta?.priority ? `priority: ${chunkMeta.priority}` : null,
      chunkMeta?.sprint ? `sprint: ${chunkMeta.sprint}` : null, date,
    ].filter(Boolean)
    return `[${parts.join(' | ')}] `
  }

  const parts = [doc.source_type, doc.title, doc.author, date].filter(Boolean)
  return parts.length > 0 ? `[${parts.join(' | ')}] ` : ''
}

async function getUserDocIds(userId: string): Promise<string[]> {
  const { data: connections } = await supabaseServer
    .from('connection')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (!connections?.length) return []

  const { data: docs } = await supabaseServer
    .from('document')
    .select('id')
    .in('connection_id', connections.map(c => c.id))

  return docs?.map(d => d.id) || []
}

async function countNullEmbeddings(docIds: string[]): Promise<number> {
  let total = 0
  for (let i = 0; i < docIds.length; i += ID_BATCH) {
    const batch = docIds.slice(i, i + ID_BATCH)
    const { count } = await supabaseServer
      .from('chunk')
      .select('id', { count: 'exact', head: true })
      .in('document_id', batch)
      .is('embedding', null)
    total += count || 0
  }
  return total
}

export async function POST(request: NextRequest) {
  const userId = await getSession()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reset = request.nextUrl.searchParams.get('reset') === 'true'
  const docIds = await getUserDocIds(userId)

  if (docIds.length === 0) {
    return NextResponse.json({ error: 'No documents found' }, { status: 404 })
  }

  if (reset) {
    let nulled = 0
    for (let i = 0; i < docIds.length; i += ID_BATCH) {
      const batch = docIds.slice(i, i + ID_BATCH)
      const { data } = await supabaseServer
        .from('chunk')
        .update({ embedding: null })
        .in('document_id', batch)
        .not('embedding', 'is', null)
        .select('id')
      nulled += data?.length || 0
    }
    const remaining = await countNullEmbeddings(docIds)
    return NextResponse.json({ step: 'reset', nulled, remaining })
  }

  const chunks: { id: string; content: string; metadata: Record<string, unknown> | null; document: ChunkDoc | null }[] = []
  for (let i = 0; i < docIds.length; i += ID_BATCH) {
    const batch = docIds.slice(i, i + ID_BATCH)
    const { data } = await supabaseServer
      .from('chunk')
      .select('id, content, metadata, document:document_id(title, source_type, author, doc_type, document_date)')
      .in('document_id', batch)
      .is('embedding', null)
      .limit(PER_REQUEST)
    if (data) chunks.push(...(data as unknown as typeof chunks))
    if (chunks.length >= PER_REQUEST) break
  }

  const page = chunks.slice(0, PER_REQUEST)
  if (page.length === 0) {
    return NextResponse.json({ step: 'embed', embedded: 0, remaining: 0, done: true })
  }

  let embedded = 0
  for (let i = 0; i < page.length; i += EMBED_BATCH) {
    const batch = page.slice(i, i + EMBED_BATCH)
    const texts = batch.map(c => {
      const prefix = buildMetadataPrefix(c.document, c.metadata)
      return prefix + c.content
    })

    try {
      const embeddings = await embedTexts(texts)
      if (i > 0) await new Promise(r => setTimeout(r, 1000))

      for (let j = 0; j < batch.length; j++) {
        const { error } = await supabaseServer
          .from('chunk')
          .update({ embedding: JSON.stringify(embeddings[j]) })
          .eq('id', batch[j].id)
        if (!error) embedded++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message.includes('maximum input length')) {
        for (const chunk of batch) {
          try {
            const prefix = buildMetadataPrefix(chunk.document, chunk.metadata)
            const [embedding] = await embedTexts([prefix + chunk.content])
            const { error } = await supabaseServer
              .from('chunk')
              .update({ embedding: JSON.stringify(embedding) })
              .eq('id', chunk.id)
            if (!error) embedded++
          } catch {
            console.error(`Chunk ${chunk.id} too large, skipping`)
          }
        }
      } else {
        console.error(`Embed batch failed: ${message}`)
      }
    }
  }

  const remaining = await countNullEmbeddings(docIds)
  return NextResponse.json({ step: 'embed', embedded, remaining, done: remaining === 0 })
}
