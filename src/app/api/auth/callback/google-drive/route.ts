import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { getSession } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  const userId = await getSession()
  if (!userId) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'No authorization code' }, { status: 400 })
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenResponse.json()
  if (tokens.error) {
    return NextResponse.json({ error: tokens.error_description }, { status: 400 })
  }

  const { error: connError } = await supabaseServer
    .from('connection')
    .upsert(
      {
        user_id: userId,
        source_type: 'google_drive',
        oauth_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        status: 'active',
      },
      { onConflict: 'user_id,source_type' }
    )

  if (connError) {
    return NextResponse.json({ error: 'Failed to store connection' }, { status: 500 })
  }

  return NextResponse.redirect(new URL('/', request.url))
}
