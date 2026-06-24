import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { supabaseServer } from '@/lib/db/supabase-server'
import SettingsView from '@/components/SettingsView'

export default async function SettingsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/')

  const { data: connections } = await supabaseServer
    .from('connection')
    .select('id, source_type, status, last_synced_at')
    .eq('user_id', user.id)

  return <SettingsView user={user} connections={connections || []} />
}
