import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/manager'

function toScore(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = parseInt(v, 10)
  return Number.isNaN(n) || n < 0 ? null : n
}

// Set or clear a fixture's result.
export async function PATCH(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const { id, home_goals, away_goals } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'Missing fixture' }, { status: 400 })

  const h = toScore(home_goals)
  const a = toScore(away_goals)
  if ((h === null) !== (a === null)) {
    return NextResponse.json({ error: 'Enter both scores, or clear both' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('fixtures').update({ home_goals: h, away_goals: a }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
