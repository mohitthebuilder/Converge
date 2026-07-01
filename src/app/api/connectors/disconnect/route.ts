import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { getSession } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  try {
    const userId = await getSession()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sourceType } = await request.json()
    if (!sourceType) {
      return NextResponse.json({ error: 'sourceType required' }, { status: 400 })
    }

    const { error } = await supabaseServer
      .from('connection')
      .update({ status: 'disconnected' })
      .eq('user_id', userId)
      .eq('source_type', sourceType)
      .eq('status', 'active')

    if (error) {
      console.error('[DISCONNECT]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DISCONNECT]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
