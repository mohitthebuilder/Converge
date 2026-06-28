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

  const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      redirect_uri: process.env.SLACK_REDIRECT_URI!,
    }),
  })

  const data = await tokenResponse.json()
  if (!data.ok) {
    return NextResponse.json({ error: data.error }, { status: 400 })
  }

  const userToken = data.authed_user?.access_token
  if (!userToken) {
    return NextResponse.json({ error: 'No user token returned' }, { status: 400 })
  }

  const { error: connError } = await supabaseServer
    .from('connection')
    .upsert(
      {
        user_id: userId,
        source_type: 'slack',
        oauth_token: userToken,
        refresh_token: null,
        status: 'active',
      },
      { onConflict: 'user_id,source_type' }
    )

  if (connError) {
    return NextResponse.json({ error: 'Failed to store connection' }, { status: 500 })
  }

  return NextResponse.redirect(new URL('/?sync=slack', request.url))
}
