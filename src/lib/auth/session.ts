import { createClient } from '@/lib/supabase/server'
import { supabaseServer } from '@/lib/db/supabase-server'

export async function getSession(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data: user } = await supabaseServer
    .from('users')
    .select('id')
    .eq('email', authUser.email!)
    .single()

  if (user) return user.id

  const name = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User'
  const { data: newUser } = await supabaseServer
    .from('users')
    .insert({
      id: authUser.id,
      email: authUser.email!,
      name,
      avatar_url: authUser.user_metadata?.avatar_url || null,
    })
    .select('id')
    .single()

  return newUser?.id || null
}

export async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data: user } = await supabaseServer
    .from('users')
    .select('id, email, name, avatar_url')
    .eq('email', authUser.email!)
    .single()

  if (user) return user

  const name = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User'
  const { data: newUser } = await supabaseServer
    .from('users')
    .insert({
      id: authUser.id,
      email: authUser.email!,
      name,
      avatar_url: authUser.user_metadata?.avatar_url || null,
    })
    .select('id, email, name, avatar_url')
    .single()

  return newUser
}
