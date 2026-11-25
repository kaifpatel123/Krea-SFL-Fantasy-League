import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/manager'

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD']
const LEAGUES = ['MSFL', 'WSFL']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function playerFields(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const position = typeof body?.position === 'string' ? body.position : ''
  const league = typeof body?.league === 'string' ? body.league : ''
  const auctionTeam = typeof body?.auction_team === 'string' ? body.auction_team.trim() : ''
  const batch = typeof body?.batch === 'string' ? body.batch.trim() : ''
  const source = typeof body?.source === 'string' ? body.source.trim() : ''
  const auctionPrice = Number(body?.auction_price)
  const fantasyPrice = Number(body?.fantasy_price)

  if (!name || name.length > 120) return { error: 'Enter a player name up to 120 characters' }
  if (!POSITIONS.includes(position)) return { error: 'Choose a valid player position' }
  if (!LEAGUES.includes(league)) return { error: 'Choose MSFL or WSFL' }
  if (!auctionTeam || auctionTeam.length > 120) return { error: 'Enter the player’s auction team' }
  if (
    !Number.isFinite(auctionPrice) ||
    auctionPrice < 0 ||
    auctionPrice > 999.9 ||
    !Number.isFinite(fantasyPrice) ||
    fantasyPrice < 0 ||
    fantasyPrice > 999.9
  ) {
    return { error: 'Prices must be between 0 and 999.9' }
  }
  if (batch.length > 80 || source.length > 160) return { error: 'Batch or source value is too long' }

  return {
    values: {
      name,
      position,
      league,
      auction_team: auctionTeam,
      auction_price: auctionPrice,
      fantasy_price: fantasyPrice,
      batch: batch || null,
      source: source || null,
    },
  }
}

async function findReferences(admin, id) {
  return Promise.all([
    admin.from('player_stats').select('id').eq('player_id', id).limit(1).maybeSingle(),
    admin.from('squad_players').select('id').eq('player_id', id).limit(1).maybeSingle(),
    admin.from('squads').select('id').eq('captain_id', id).limit(1).maybeSingle(),
    admin.from('squads').select('id').eq('vice_captain_id', id).limit(1).maybeSingle(),
  ])
}

function referenceFailure(references) {
  const failure = references.find((result) => result.error)
  if (failure) return { status: 500, error: failure.error.message }
  if (references.some((result) => result.data)) {
    return {
      status: 409,
      error: 'This player has saved squads or stats. Deletion and changes to position, league, or auction team are blocked to preserve history.',
    }
  }
  return null
}

export async function POST(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const { values, error: validationError } = playerFields(body)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const { data, error } = await createAdminClient().from('players').insert(values).select('id').single()
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A player with this name, auction team, and league already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}

export async function PATCH(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!UUID.test(id)) return NextResponse.json({ error: 'A valid player is required' }, { status: 400 })

  const { values, error: validationError } = playerFields(body)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const admin = createAdminClient()
  const { data: current, error: readError } = await admin.from('players').select('*').eq('id', id).maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!current) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const identityChanged = ['position', 'league', 'auction_team'].some((field) => values[field] !== current[field])
  if (identityChanged) {
    const references = await findReferences(admin, id)
    const blocked = referenceFailure(references)
    if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status })
  }

  const { data: updated, error } = await admin
    .from('players')
    .update(values)
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A player with this name, auction team, and league already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!updated) return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const id = new URL(request.url).searchParams.get('id') || ''
  if (!UUID.test(id)) return NextResponse.json({ error: 'A valid player is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: player, error: readError } = await admin.from('players').select('id').eq('id', id).maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const references = await findReferences(admin, id)
  const blocked = referenceFailure(references)
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status })

  const { error } = await admin.from('players').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
