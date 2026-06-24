import { getSessionUser } from '@/lib/auth/session'
import { supabaseServer } from '@/lib/db/supabase-server'
import OnboardingScreen from '@/components/OnboardingScreen'
import SearchView from '@/components/SearchView'

export default async function Home() {
  const user = await getSessionUser()

  if (!user) {
    return <OnboardingScreen />
  }

  const { data: connections } = await supabaseServer
    .from('connection')
    .select('source_type, status, last_synced_at')
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
    />
  )
}
