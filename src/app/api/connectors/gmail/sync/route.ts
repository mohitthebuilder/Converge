import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { fetchExistingDocs, batchUpsertDocuments, mapWithConcurrency, hashContent, DocumentRow } from '@/lib/db/sync'

export const maxDuration = 60

async function refreshAccessToken(connectionId: string, refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const tokens = await response.json()
  if (tokens.error) throw new Error(tokens.error_description)

  await supabaseServer
    .from('connection')
    .update({ oauth_token: tokens.access_token })
    .eq('id', connectionId)

  return tokens.access_token
}

async function getAccessToken(connection: { id: string; oauth_token: string; refresh_token: string }): Promise<string> {
  const test = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${connection.oauth_token}` },
  })

  if (test.ok) return connection.oauth_token
  return refreshAccessToken(connection.id, connection.refresh_token)
}

function base64UrlDecode(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getHeader(message: { payload?: { headers?: Array<{ name: string; value: string }> } }, name: string): string {
  const header = message.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )
  return header?.value || ''
}

function extractBody(payload: { body?: { data?: string }; mimeType?: string; parts?: Array<{ mimeType: string; body?: { data?: string }; parts?: unknown[] }> }): string {
  if (payload.body?.data) {
    return base64UrlDecode(payload.body.data)
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return base64UrlDecode(part.body.data)
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return stripHtml(base64UrlDecode(part.body.data))
      }
    }
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractBody(part as typeof payload)
        if (nested) return nested
      }
    }
  }

  return ''
}

interface GmailMessage {
  id: string
  payload: {
    headers: Array<{ name: string; value: string }>
    body?: { data?: string }
    mimeType?: string
    parts?: Array<{ mimeType: string; body?: { data?: string }; parts?: unknown[] }>
  }
}

interface GmailThread {
  id: string
  messages: GmailMessage[]
}

function formatMessage(msg: GmailMessage, subject: string): { content: string; author: string; messageDate: string | null } {
  const from = getHeader(msg, 'From')
  const to = getHeader(msg, 'To')
  const cc = getHeader(msg, 'Cc')
  const date = getHeader(msg, 'Date')
  const body = extractBody(msg.payload)

  let content = `Subject: ${subject}\nFrom: ${from}`
  if (to) content += `\nTo: ${to}`
  if (cc) content += `\nCc: ${cc}`
  content += `\nDate: ${date}\n\n${body}`

  let messageDate: string | null = null
  if (date) {
    const parsed = new Date(date)
    if (!isNaN(parsed.getTime())) messageDate = parsed.toISOString()
  }

  return { content, author: from, messageDate }
}

export async function POST(request: NextRequest) {
  const { connectionId } = await request.json()

  const { data: connection, error: connError } = await supabaseServer
    .from('connection')
    .select('id, user_id, oauth_token, refresh_token')
    .eq('id', connectionId)
    .eq('source_type', 'gmail')
    .single()

  if (connError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  const accessToken = await getAccessToken(connection)

  const { data: user } = await supabaseServer
    .from('users')
    .select('email')
    .eq('id', connection.user_id)
    .single()
  const userEmail = user?.email || ''

  const threadIds: string[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      q: 'newer_than:90d -in:spam -in:trash -in:drafts -category:social -category:updates -category:promotions',
      maxResults: '100',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    const data = await response.json()
    for (const thread of data.threads || []) {
      threadIds.push(thread.id)
    }
    pageToken = data.nextPageToken
  } while (pageToken)

  // One batched lookup instead of one query per message (Vercel timeout root cause)
  const existingDocs = await fetchExistingDocs(connection.id)
  const seen = new Set<string>()
  const rows: DocumentRow[] = []
  let synced = 0

  // Threads fetched in parallel (concurrency 5 stays under Gmail's 250 quota units/s:
  // threads.get costs 10 units). One bad thread must not abort the whole sync.
  await mapWithConcurrency(threadIds, 5, async (threadId) => {
    let thread: GmailThread
    try {
      const threadResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      thread = await threadResponse.json()
    } catch (err) {
      console.error(`[SYNC] skipping thread ${threadId}: ${err instanceof Error ? err.message : err}`)
      return
    }
    const messages = thread.messages || []
    if (messages.length === 0) return

    const subject = getHeader(messages[0], 'Subject') || '(No subject)'
    const threadUrl = `https://mail.google.com/mail/?authuser=${encodeURIComponent(userEmail)}#inbox/${threadId}`

    for (const msg of messages) {
      if (seen.has(msg.id)) continue
      seen.add(msg.id)

      const { content, author, messageDate } = formatMessage(msg, subject)
      if (!content.trim()) continue

      const contentHash = hashContent(content)
      if (existingDocs.get(msg.id)?.contentHash === contentHash) continue

      rows.push({
        connection_id: connection.id,
        source_type: 'gmail',
        source_id: msg.id,
        source_url: threadUrl,
        title: subject,
        content,
        author,
        doc_type: 'email',
        content_hash: contentHash,
        document_date: messageDate || new Date().toISOString(),
      })
      synced++

      // Flush periodically so partial progress survives a timeout
      if (rows.length >= 100) await batchUpsertDocuments(rows.splice(0))
    }
  })

  await batchUpsertDocuments(rows)

  await supabaseServer
    .from('connection')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', connection.id)

  return NextResponse.json({ synced, total: threadIds.length, connectionId: connection.id })
}
