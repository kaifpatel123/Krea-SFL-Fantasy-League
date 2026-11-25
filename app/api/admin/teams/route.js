import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/manager'

const LEAGUES = ['MSFL', 'WSFL']

function teamFields(body) {
  const key = typeof body?.key === 'string' ? body.key.trim() : ''
  const club = typeof body?.club === 'string' ? body.club.trim() : ''
  const league = typeof body?.league === 'string' ? body.league : ''
  if (!key || key.length > 120) return { error: 'Enter a team key up to 120 characters' }
  if (!club || club.length > 120) return { error: 'Enter a display name up to 120 characters' }
  if (!LEAGUES.includes(league)) return { error: 'Choose MSFL or WSFL' }
  return { values: { key, club, league } }
}

async function findReferences(admin, key) {
  return Promise.all([
    admin.from('players').select('id').eq('auction_team', key).limit(1).maybeSingle(),
    admin.from('fixtures').select('id').eq('home', key).limit(1).maybeSingle(),
    admin.from('fixtures').select('id').eq('away', key).limit(1).maybeSingle(),
  ])
}

function referenceFailure(results) {
  const failure = results.find((result) => result.error)
  if (failure) return { status: 500, error: failure.error.message }
  if (results.some((result) => result.data)) {
    return { status: 409, error: 'This team is used by players or fixtures. Update those records first to preserve their links.' }
  }
  return null
}

export async function POST(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const { values, error: validationError } = teamFields(body)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const { error } = await createAdminClient().from('teams').insert(values)
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'That team key already exists' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function PATCH(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const originalKey = typeof body?.originalKey === 'string' ? body.originalKey.trim() : ''
  const { values, error: validationError } = teamFields(body)
  if (!originalKey) return NextResponse.json({ error: 'A valid existing team is required' }, { status: 400 })
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const admin = createAdminClient()
  if (values.key !== originalKey || values.league !== body.originalLeague) {
    const references = await findReferences(admin, originalKey)
    const blocked = referenceFailure(references)
    if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status })
  }

  const { data: updated, error } = await admin
    .from('teams')
    .update(values)
    .eq('key', originalKey)
    .select('key')
    .maybeSingle()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'That team key already exists' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!updated) return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const key = new URL(request.url).searchParams.get('key') || ''
  if (!key.trim()) return NextResponse.json({ error: 'A valid team is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: team, error: readError } = await admin.from('teams').select('key').eq('key', key).maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const references = await findReferences(admin, key)
  const blocked = referenceFailure(references)
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status })

  const { error } = await admin.from('teams').delete().eq('key', key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
