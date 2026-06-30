import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'

const NINETY_DAYS_SEC = 90 * 24 * 60 * 60

interface SlackMessage {
  ts: string
  text?: string
  user?: string
  bot_id?: string
  subtype?: string
  thread_ts?: string
  reply_count?: number
}

async function slackApi(endpoint: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://slack.com/api/${endpoint}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.json()
}

function cleanSlackText(text: string, userCache: Map<string, string>): string {
  return text
    .replace(/<@(U[A-Z0-9]+)>/g, (_, id) => `@${userCache.get(id) || id}`)
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<(https?:[^>]+)>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export async function POST(request: NextRequest) {
  const { connectionId } = await request.json()

  const { data: connection, error: connError } = await supabaseServer
    .from('connection')
    .select('id, user_id, oauth_token')
    .eq('id', connectionId)
    .eq('source_type', 'slack')
    .single()

  if (connError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  const token = connection.oauth_token
  const oldest = String(Math.floor((Date.now() - NINETY_DAYS_SEC * 1000) / 1000))

  // List channels (public + private user is in)
  const channels: Array<{ id: string; name: string }> = []
  let cursor: string | undefined
  do {
    const params: Record<string, string> = {
      types: 'public_channel,private_channel',
      limit: '200',
      exclude_archived: 'true',
    }
    if (cursor) params.cursor = cursor
    const result = await slackApi('conversations.list', token, params)
    if (!result.ok) break
    for (const c of result.channels || []) {
      if (c.is_member) channels.push({ id: c.id, name: c.name })
    }
    cursor = result.response_metadata?.next_cursor || undefined
  } while (cursor)

  // User display name cache
  const userCache = new Map<string, string>()
  async function getUserName(userId: string): Promise<string> {
    if (userCache.has(userId)) return userCache.get(userId)!
    const result = await slackApi('users.info', token, { user: userId })
    const name = result.ok
      ? (result.user.profile?.display_name || result.user.real_name || userId)
      : userId
    userCache.set(userId, name)
    return name
  }

  let synced = 0

  for (const channel of channels) {
    // Fetch channel messages (90-day window)
    const messages: SlackMessage[] = []
    let msgCursor: string | undefined
    do {
      const params: Record<string, string> = { channel: channel.id, oldest, limit: '200' }
      if (msgCursor) params.cursor = msgCursor
      const result = await slackApi('conversations.history', token, params)
      if (!result.ok) break
      messages.push(...(result.messages || []))
      msgCursor = result.has_more ? (result.response_metadata?.next_cursor || undefined) : undefined
    } while (msgCursor)

    for (const msg of messages) {
      if (msg.bot_id || msg.subtype || !msg.text?.trim()) continue

      const username = msg.user ? await getUserName(msg.user) : 'Unknown'
      const cleanText = cleanSlackText(msg.text, userCache)
      const msgDate = new Date(parseFloat(msg.ts) * 1000)
      const tsNoDot = msg.ts.replace('.', '')

      // Store parent/top-level message
      const sourceId = `${channel.id}:${msg.ts}`
      const sourceUrl = `https://app.slack.com/archives/${channel.id}/p${tsNoDot}`
      const contentHash = Buffer.from(cleanText).toString('base64').slice(0, 32)

      const { data: existing } = await supabaseServer
        .from('document')
        .select('id, content_hash')
        .eq('connection_id', connection.id)
        .eq('source_id', sourceId)
        .single()

      if (existing?.content_hash !== contentHash) {
        await supabaseServer
          .from('document')
          .upsert(
            {
              connection_id: connection.id,
              source_type: 'slack',
              source_id: sourceId,
              source_url: sourceUrl,
              title: `#${channel.name}`,
              content: cleanText,
              author: username,
              doc_type: 'slack_message',
              content_hash: contentHash,
              document_date: msgDate.toISOString(),
            },
            { onConflict: 'connection_id,source_id' }
          )
        synced++
      }

      // Fetch and store thread replies
      if (msg.reply_count && msg.reply_count > 0) {
        const threadResult = await slackApi('conversations.replies', token, {
          channel: channel.id,
          ts: msg.ts,
          oldest,
          limit: '200',
        })
        if (!threadResult.ok) continue

        const replies = (threadResult.messages || []).slice(1)
        const parentSnippet = cleanText.slice(0, 100)

        for (const reply of replies) {
          if (reply.bot_id || reply.subtype || !reply.text?.trim()) continue

          const replyUsername = reply.user ? await getUserName(reply.user) : 'Unknown'
          const replyClean = cleanSlackText(reply.text, userCache)
          const replyContent = `[Thread reply to: "${parentSnippet}"]\n\n${replyClean}`
          const replyDate = new Date(parseFloat(reply.ts) * 1000)
          const replyTsNoDot = reply.ts.replace('.', '')
          const replySourceId = `${channel.id}:${reply.ts}`
          const replyUrl = `https://app.slack.com/archives/${channel.id}/p${replyTsNoDot}?thread_ts=${msg.ts}`
          const replyHash = Buffer.from(replyContent).toString('base64').slice(0, 32)

          const { data: existingReply } = await supabaseServer
            .from('document')
            .select('id, content_hash')
            .eq('connection_id', connection.id)
            .eq('source_id', replySourceId)
            .single()

          if (existingReply?.content_hash !== replyHash) {
            await supabaseServer
              .from('document')
              .upsert(
                {
                  connection_id: connection.id,
                  source_type: 'slack',
                  source_id: replySourceId,
                  source_url: replyUrl,
                  title: `#${channel.name}`,
                  content: replyContent,
                  author: replyUsername,
                  doc_type: 'slack_message',
                  content_hash: replyHash,
                  document_date: replyDate.toISOString(),
                },
                { onConflict: 'connection_id,source_id' }
              )
            synced++
          }
        }
      }
    }
  }

  await supabaseServer
    .from('connection')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', connection.id)

  return NextResponse.json({ synced, total: synced, connectionId: connection.id })
}
