import { NextResponse } from 'next/server'

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID!,
    redirect_uri: process.env.SLACK_REDIRECT_URI!,
    user_scope: 'channels:history,channels:read,groups:read,groups:history,users:read',
  })

  return NextResponse.redirect(`https://slack.com/oauth/v2/authorize?${params}`)
}
