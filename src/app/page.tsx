import { getSessionUser } from '@/lib/auth/session'
import { supabaseServer } from '@/lib/db/supabase-server'
import { redirect } from 'next/navigation'
import SearchView from '@/components/SearchView'

export default async function Home({ searchParams }: { searchParams: Promise<{ sync?: string }> }) {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams

  const { data: connections } = await supabaseServer
    .from('connection')
    .select('id, source_type, status, last_synced_at')
    .eq('user_id', user.id)
    .eq('status', 'active')

  const { data: recentQueries } = await supabaseServer
    .from('query')
    .select('id, original_query, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <SearchView
      user={user}
      connections={connections || []}
      history={recentQueries || []}
      autoSync={params.sync || null}
    />
  )
}
