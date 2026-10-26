import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/manager'

// Lock / unlock a gameweek.
export async function PATCH(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const { id, is_locked } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing gameweek' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('gameweeks').update({ is_locked: !!is_locked }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
