import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { PDFParse } from 'pdf-parse'

const EXPORTABLE_TYPES: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
}

const DOWNLOADABLE_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

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
  // Test if current token works
  const test = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
    headers: { Authorization: `Bearer ${connection.oauth_token}` },
  })

  if (test.ok) return connection.oauth_token
  return refreshAccessToken(connection.id, connection.refresh_token)
}

async function fetchFileContent(fileId: string, mimeType: string, accessToken: string): Promise<string | null> {
  const headers = { Authorization: `Bearer ${accessToken}` }

  // Google-native files: export
  const exportType = EXPORTABLE_TYPES[mimeType]
  if (exportType) {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportType)}`,
      { headers }
    )
    if (!response.ok) return null
    return response.text()
  }

  // Uploaded files: download
  if (DOWNLOADABLE_TYPES.includes(mimeType)) {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers }
    )
    if (!response.ok) return null
    if (mimeType === 'application/pdf') {
      const buffer = Buffer.from(await response.arrayBuffer())
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      return result.text || null
    }
    return response.text()
  }

  return null
}

export async function POST(request: NextRequest) {
  const { connectionId } = await request.json()

  // Get connection
  const { data: connection, error: connError } = await supabaseServer
    .from('connection')
    .select('id, user_id, oauth_token, refresh_token')
    .eq('id', connectionId)
    .eq('source_type', 'google_drive')
    .single()

  if (connError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  const accessToken = await getAccessToken(connection)

  // List all supported files
  const allFiles: Array<{ id: string; name: string; mimeType: string; webViewLink: string; owners?: Array<{ displayName: string }> }> = []
  let pageToken: string | undefined

  const supportedTypes = [...Object.keys(EXPORTABLE_TYPES), ...DOWNLOADABLE_TYPES]
  const mimeQuery = supportedTypes.map(t => `mimeType='${t}'`).join(' or ')

  do {
    const params = new URLSearchParams({
      q: mimeQuery,
      fields: 'nextPageToken,files(id,name,mimeType,webViewLink,owners)',
      pageSize: '100',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const data = await response.json()
    allFiles.push(...(data.files || []))
    pageToken = data.nextPageToken
  } while (pageToken)

  // Process each file
  let synced = 0
  for (const file of allFiles) {
    const content = await fetchFileContent(file.id, file.mimeType, accessToken)
    if (!content) continue

    const contentHash = Buffer.from(content).toString('base64').slice(0, 32)

    // Check if already indexed with same content
    const { data: existing } = await supabaseServer
      .from('document')
      .select('id, content_hash')
      .eq('connection_id', connection.id)
      .eq('source_id', file.id)
      .single()

    if (existing?.content_hash === contentHash) continue

    // Upsert document
    await supabaseServer
      .from('document')
      .upsert(
        {
          connection_id: connection.id,
          source_type: 'google_drive',
          source_id: file.id,
          source_url: file.webViewLink,
          title: file.name,
          content,
          author: file.owners?.[0]?.displayName || null,
          doc_type: file.mimeType,
          content_hash: contentHash,
        },
        { onConflict: 'connection_id,source_id' }
      )

    synced++
  }

  // Update last_synced_at
  await supabaseServer
    .from('connection')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', connection.id)

  return NextResponse.json({ synced, total: allFiles.length })
}
