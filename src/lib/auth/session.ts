import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/db/supabase-server'

const COOKIE_NAME = 'converge_session'
const MAX_AGE = 30 * 24 * 60 * 60 // 30 days

export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get(COOKIE_NAME)
  return session?.value || null
}

export async function getSessionUser() {
  const userId = await getSession()
  if (!userId) return null

  const { data: user } = await supabaseServer
    .from('users')
    .select('id, email, name, avatar_url')
    .eq('id', userId)
    .single()

  return user
}

export function createSessionCookie(userId: string) {
  return {
    name: COOKIE_NAME,
    value: userId,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: MAX_AGE,
    path: '/',
  }
}

export function clearSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  }
}
