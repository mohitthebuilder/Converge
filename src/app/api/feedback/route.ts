import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { getSession } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  const userId = await getSession()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { answerId, rating } = await request.json()
  if (!answerId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { error } = await supabaseServer
    .from('feedback')
    .upsert(
      { answer_id: answerId, user_id: userId, rating },
      { onConflict: 'answer_id,user_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
