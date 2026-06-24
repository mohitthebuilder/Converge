import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { clearSessionCookie } from '@/lib/auth/session'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.set(clearSessionCookie())
  return NextResponse.json({ ok: true })
}
