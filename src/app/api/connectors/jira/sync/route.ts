import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'

interface JiraIssue {
  key: string
  fields: {
    summary: string
    description: unknown
    issuetype: { name: string }
    status: { name: string }
    project: { key: string; name: string }
    assignee: { displayName: string } | null
    reporter: { displayName: string } | null
    priority: { name: string } | null
    updated: string
    created: string
    comment?: { comments: Array<{ body: unknown; author: { displayName: string }; created: string }> }
    sprint?: { name: string } | null
    labels?: string[]
  }
}

function adfToText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as Record<string, unknown>

  if (n.type === 'text') return (n.text as string) || ''

  if (n.type === 'mention' && n.attrs) {
    return `@${(n.attrs as Record<string, string>).text || ''}`
  }

  if (n.type === 'hardBreak') return '\n'

  if (Array.isArray(n.content)) {
    const inner = (n.content as unknown[]).map(adfToText).join('')
    switch (n.type) {
      case 'paragraph': return inner + '\n\n'
      case 'heading': return inner + '\n'
      case 'bulletList':
      case 'orderedList': return inner + '\n'
      case 'listItem': return '• ' + inner
      case 'codeBlock': return '```\n' + inner + '\n```\n'
      case 'blockquote': return '> ' + inner
      case 'table': return inner
      case 'tableRow': return inner + '\n'
      case 'tableCell':
      case 'tableHeader': return inner + '\t'
      default: return inner
    }
  }

  return ''
}

function formatIssue(issue: JiraIssue): string {
  const f = issue.fields
  const parts: string[] = []

  parts.push(`Status: ${f.status.name}`)
  parts.push(`Type: ${f.issuetype.name}`)
  if (f.priority) parts.push(`Priority: ${f.priority.name}`)
  if (f.assignee) parts.push(`Assignee: ${f.assignee.displayName}`)
  if (f.reporter) parts.push(`Reporter: ${f.reporter.displayName}`)
  if (f.labels?.length) parts.push(`Labels: ${f.labels.join(', ')}`)
  if (f.sprint) parts.push(`Sprint: ${(f.sprint as { name: string }).name}`)

  let content = parts.join('\n') + '\n\n'

  if (f.description) {
    const descText = adfToText(f.description).trim()
    if (descText) content += `Description:\n${descText}\n\n`
  }

  if (f.comment?.comments?.length) {
    content += 'Comments:\n'
    for (const c of f.comment.comments) {
      const body = adfToText(c.body).trim()
      if (body) content += `[${c.author.displayName}]: ${body}\n\n`
    }
  }

  return content.trim()
}

async function getCloudId(accessToken: string): Promise<string | null> {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  const sites = await res.json()
  if (!Array.isArray(sites) || sites.length === 0) return null
  return sites[0].id
}

async function refreshToken(connectionId: string, refreshTokenValue: string): Promise<string | null> {
  const res = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: process.env.JIRA_CLIENT_ID!,
      client_secret: process.env.JIRA_CLIENT_SECRET!,
      refresh_token: refreshTokenValue,
    }),
  })
  const tokens = await res.json()
  if (tokens.error) return null

  await supabaseServer
    .from('connection')
    .update({
      oauth_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refreshTokenValue,
    })
    .eq('id', connectionId)

  return tokens.access_token
}

export async function POST(request: NextRequest) {
  const { connectionId } = await request.json()

  const { data: connection, error: connError } = await supabaseServer
    .from('connection')
    .select('id, user_id, oauth_token, refresh_token')
    .eq('id', connectionId)
    .eq('source_type', 'jira')
    .single()

  if (connError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  let token = connection.oauth_token
  let cloudId = await getCloudId(token)

  if (!cloudId && connection.refresh_token) {
    const newToken = await refreshToken(connection.id, connection.refresh_token)
    if (newToken) {
      token = newToken
      cloudId = await getCloudId(token)
    }
  }

  if (!cloudId) {
    return NextResponse.json({ error: 'No accessible Jira site' }, { status: 400 })
  }

  const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' }

  let synced = 0
  let startAt = 0
  const maxResults = 50

  while (true) {
    const jql = encodeURIComponent('updated >= -90d ORDER BY updated DESC')
    const fields = 'summary,description,issuetype,status,project,assignee,reporter,priority,updated,created,comment,sprint,labels'
    const url = `${baseUrl}/search?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}&fields=${fields}`

    const res = await fetch(url, { headers })
    if (!res.ok) break

    const data = await res.json()
    const issues: JiraIssue[] = data.issues || []
    if (issues.length === 0) break

    for (const issue of issues) {
      const content = formatIssue(issue)
      const contentHash = Buffer.from(content).toString('base64').slice(0, 32)
      const sourceId = issue.key
      const sourceUrl = `https://api.atlassian.com/ex/jira/${cloudId}/browse/${issue.key}`

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
              source_type: 'jira',
              source_id: sourceId,
              source_url: sourceUrl,
              title: `${issue.key}: ${issue.fields.summary}`,
              content,
              author: issue.fields.reporter?.displayName || null,
              doc_type: 'jira_issue',
              content_hash: contentHash,
              indexed_at: issue.fields.updated,
            },
            { onConflict: 'connection_id,source_id' }
          )
        synced++
      }
    }

    startAt += issues.length
    if (startAt >= (data.total || 0)) break
  }

  await supabaseServer
    .from('connection')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', connection.id)

  return NextResponse.json({ synced, total: synced, connectionId: connection.id })
}
