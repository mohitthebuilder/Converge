import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'

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

function formatThread(thread: GmailThread): { subject: string; content: string; author: string } {
  const messages = thread.messages || []
  const firstMessage = messages[0]
  const subject = getHeader(firstMessage, 'Subject') || '(No subject)'
  const author = getHeader(firstMessage, 'From')

  const formattedMessages = messages.map((msg) => {
    const from = getHeader(msg, 'From')
    const to = getHeader(msg, 'To')
    const cc = getHeader(msg, 'Cc')
    const date = getHeader(msg, 'Date')
    const body = extractBody(msg.payload)

    let header = `From: ${from}\nDate: ${date}`
    if (to) header += `\nTo: ${to}`
    if (cc) header += `\nCc: ${cc}`

    return `${header}\n\n${body}`
  })

  const content = `Subject: ${subject}\n\n${formattedMessages.join('\n\n---\n\n')}`
  return { subject, content, author }
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

  const threadIds: string[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      q: 'newer_than:90d -in:spam -in:trash -in:drafts',
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

  let synced = 0
  for (const threadId of threadIds) {
    const threadResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const thread: GmailThread = await threadResponse.json()

    const { subject, content, author } = formatThread(thread)
    if (!content.trim()) continue

    const contentHash = Buffer.from(content).toString('base64').slice(0, 32)

    const { data: existing } = await supabaseServer
      .from('document')
      .select('id, content_hash')
      .eq('connection_id', connection.id)
      .eq('source_id', threadId)
      .single()

    if (existing?.content_hash === contentHash) continue

    await supabaseServer
      .from('document')
      .upsert(
        {
          connection_id: connection.id,
          source_type: 'gmail',
          source_id: threadId,
          source_url: `https://mail.google.com/mail/u/0/#inbox/${threadId}`,
          title: subject,
          content,
          author,
          doc_type: 'email_thread',
          content_hash: contentHash,
        },
        { onConflict: 'connection_id,source_id' }
      )

    synced++
  }

  await supabaseServer
    .from('connection')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', connection.id)

  return NextResponse.json({ synced, total: threadIds.length, connectionId: connection.id })
}
