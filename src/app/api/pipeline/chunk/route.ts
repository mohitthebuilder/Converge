import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { normalize } from '@/lib/pipeline/normalize'
import { chunkDocument } from '@/lib/pipeline/chunk'

export async function POST(request: NextRequest) {
  const { connectionId } = await request.json()

  // Get all documents for this connection that haven't been chunked yet
  const { data: documents, error } = await supabaseServer
    .from('document')
    .select('id, content, doc_type, title, source_type, author, indexed_at')
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

    // Build tool-specific metadata for chunks
    const baseMeta: Record<string, unknown> = {
      title: doc.title,
      doc_type: doc.doc_type,
      source_type: doc.source_type,
      author: doc.author,
    }

    if (doc.source_type === 'gmail') {
      const toMatches = cleaned.match(/^To: (.+)$/gm)
      const ccMatches = cleaned.match(/^Cc: (.+)$/gm)
      const allRecipients = new Set<string>()
      ;[...(toMatches || []), ...(ccMatches || [])].forEach(line => {
        line.replace(/^(?:To|Cc): /, '').split(',').forEach(r => {
          const name = r.trim().split('<')[0].trim()
          if (name) allRecipients.add(name)
        })
      })
      baseMeta.recipients = [...allRecipients].slice(0, 5).join(', ')
      baseMeta.message_count = (cleaned.match(/^From: /gm) || []).length
    }

    if (doc.source_type === 'slack') {
      baseMeta.channel = doc.title?.replace(/^#/, '')
      baseMeta.username = doc.author
      const replyMatch = cleaned.match(/^\[Thread reply to: "(.+?)"\]\n\n/)
      if (replyMatch) {
        baseMeta.reply_context = `reply to: "${replyMatch[1]}"`
      }
    }

    if (doc.source_type === 'jira') {
      const keyMatch = doc.title?.match(/^([A-Z]+-\d+):/)
      if (keyMatch) baseMeta.issue_key = keyMatch[1]
      const statusMatch = cleaned.match(/^Status: (.+)$/m)
      if (statusMatch) baseMeta.status = statusMatch[1]
      const typeMatch = cleaned.match(/^Type: (.+)$/m)
      if (typeMatch) baseMeta.issue_type = typeMatch[1]
      const priorityMatch = cleaned.match(/^Priority: (.+)$/m)
      if (priorityMatch) baseMeta.priority = priorityMatch[1]
      const assigneeMatch = cleaned.match(/^Assignee: (.+)$/m)
      if (assigneeMatch) baseMeta.assignee = assigneeMatch[1]
      const sprintMatch = cleaned.match(/^Sprint: (.+)$/m)
      if (sprintMatch) baseMeta.sprint = sprintMatch[1]
      const projectMatch = doc.title?.match(/^([A-Z]+)-/)
      if (projectMatch) baseMeta.project = projectMatch[1]
    }

    // Store chunks — merge table metadata if present
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
