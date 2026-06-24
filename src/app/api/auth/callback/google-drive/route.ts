import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/db/supabase-server'
import { createSessionCookie } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'No authorization code' }, { status: 400 })
  }

  // Exchange code for tokens
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

  // Fetch user profile from Google
  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = await profileResponse.json()

  // Find or create user by email
  let { data: user } = await supabaseServer
    .from('users')
    .select('id')
    .eq('email', profile.email)
    .single()

  if (!user) {
    const { data: newUser, error } = await supabaseServer
      .from('users')
      .insert({ email: profile.email, name: profile.name, avatar_url: profile.picture })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create user', detail: error.message, code: error.code, profile }, { status: 500 })
    }
    user = newUser
  }

  // Store connection (upsert in case reconnecting)
  const { error: connError } = await supabaseServer
    .from('connection')
    .upsert(
      {
        user_id: user.id,
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

  const cookieStore = await cookies()
  cookieStore.set(createSessionCookie(user.id))

  return NextResponse.redirect(new URL('/', request.url))
}
