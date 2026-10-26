import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase-server'
import { MANAGER_COOKIE, getManager } from '@/lib/manager'
import { TEST_MODE, BUDGET } from '@/lib/config'

// Test mode only: create a throwaway manager and remember them with a cookie.
export async function POST(request) {
  if (!TEST_MODE) return NextResponse.json({ error: 'Test mode is off' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const name = String(body.name || '').trim().slice(0, 40)
  if (!name) return NextResponse.json({ error: 'Enter a team name' }, { status: 400 })

  const admin = createAdminClient()
  const email = `test-${randomUUID().slice(0, 8)}@fsfl.test`

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { test_manager: true, display_name: name },
  })
  if (userErr || !created?.user) {
    return NextResponse.json({ error: userErr?.message || 'Could not create manager' }, { status: 500 })
  }

  const { error: profErr } = await admin
    .from('profiles')
    .insert({ id: created.user.id, display_name: name, email, budget: BUDGET })
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 })

  cookies().set(MANAGER_COOKIE, created.user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
  })

  return NextResponse.json({ ok: true })
}

// Forget the current test manager on this device.
export async function DELETE() {
  cookies().delete(MANAGER_COOKIE)
  return NextResponse.json({ ok: true })
}

// Signed-in managers set (or change) their team name.
export async function PATCH(request) {
  const manager = await getManager()
  if (!manager) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const name = String(body.name || '').trim().slice(0, 40)
  if (!name) return NextResponse.json({ error: 'Enter a team name' }, { status: 400 })
  const { error } = await createAdminClient().from('profiles').update({ display_name: name }).eq('id', manager.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
