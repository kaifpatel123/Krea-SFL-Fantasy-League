import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getManager } from '@/lib/manager'
import { QUOTA, SQUAD_SIZE, BUDGET, STARTERS } from '@/lib/config'
import { hasPaidEntry, PAYMENT_REQUIRED } from '@/lib/payments'

export async function POST(request) {
  const manager = await getManager()
  if (!manager) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  try {
    if (PAYMENT_REQUIRED && !(await hasPaidEntry(manager.id))) {
      return NextResponse.json({ error: 'Pay the league entry fee before creating a squad' }, { status: 403 })
    }
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Could not check entry payment' }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const playerIds = Array.from(new Set(body.playerIds || []))
  const { captainId, viceCaptainId } = body
  const starterIds = Array.from(new Set(body.starterIds || []))

  const admin = createAdminClient()

  const { data: gameweek } = await admin
    .from('gameweeks')
    .select('*')
    .eq('is_locked', false)
    .order('match_date', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!gameweek) return NextResponse.json({ error: 'No gameweek is open' }, { status: 400 })
  if (body.gameweekId && body.gameweekId !== gameweek.id) {
    return NextResponse.json({ error: 'That gameweek is locked. Refresh the page.' }, { status: 400 })
  }

  // Squads lock once saved: one save per gameweek.
  const { data: already } = await admin
    .from('squads')
    .select('id')
    .eq('profile_id', manager.id)
    .eq('gameweek_id', gameweek.id)
    .maybeSingle()
  if (already) {
    return NextResponse.json({ error: `Your squad for ${gameweek.label} is already saved and locked.` }, { status: 400 })
  }

  if (playerIds.length !== SQUAD_SIZE) {
    return NextResponse.json({ error: `Pick exactly ${SQUAD_SIZE} players` }, { status: 400 })
  }

  const { data: players } = await admin.from('players').select('id, position, fantasy_price').in('id', playerIds)
  if (!players || players.length !== SQUAD_SIZE) {
    return NextResponse.json({ error: 'Some players were not found' }, { status: 400 })
  }

  const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  players.forEach((p) => (counts[p.position] += 1))
  for (const pos of Object.keys(QUOTA)) {
    if (counts[pos] !== QUOTA[pos]) {
      return NextResponse.json({ error: `You need ${QUOTA[pos]} ${pos}` }, { status: 400 })
    }
  }

  const spent = players.reduce((s, p) => s + Number(p.fantasy_price), 0)
  const budget = Number(manager.budget) || BUDGET
  if (spent > budget + 1e-9) {
    return NextResponse.json({ error: `Over budget: ${spent.toFixed(1)} of ${budget}` }, { status: 400 })
  }

  // 6 start (goalkeeper must start), 2 outfield subs.
  if (starterIds.length !== STARTERS || !starterIds.every((id) => playerIds.includes(id))) {
    return NextResponse.json({ error: `Pick ${STARTERS} starters and ${SQUAD_SIZE - STARTERS} subs` }, { status: 400 })
  }
  const gk = players.find((p) => p.position === 'GK')
  if (!gk || !starterIds.includes(gk.id)) {
    return NextResponse.json({ error: 'Your goalkeeper has to start' }, { status: 400 })
  }

  if (!captainId || !viceCaptainId || captainId === viceCaptainId) {
    return NextResponse.json({ error: 'Pick a captain and a different vice-captain' }, { status: 400 })
  }
  if (!starterIds.includes(captainId) || !starterIds.includes(viceCaptainId)) {
    return NextResponse.json({ error: 'Captain and vice-captain must be starters' }, { status: 400 })
  }

  // Count transfers against the most recent earlier squad (first squad is free).
  let transfersUsed = 0
  const { data: mySquads } = await admin
    .from('squads')
    .select('id, gameweek_id, gameweeks(match_date)')
    .eq('profile_id', manager.id)
  const previous = (mySquads || [])
    .filter((s) => s.gameweek_id !== gameweek.id && s.gameweeks?.match_date < gameweek.match_date)
    .sort((a, b) => (b.gameweeks?.match_date || '').localeCompare(a.gameweeks?.match_date || ''))[0]
  if (previous) {
    const { data: prevPicks } = await admin.from('squad_players').select('player_id').eq('squad_id', previous.id)
    const prevIds = new Set((prevPicks || []).map((p) => p.player_id))
    transfersUsed = playerIds.filter((id) => !prevIds.has(id)).length
  }

  const { data: squad, error: squadErr } = await admin
    .from('squads')
    .insert({
      profile_id: manager.id,
      gameweek_id: gameweek.id,
      captain_id: captainId,
      vice_captain_id: viceCaptainId,
      transfers_used: transfersUsed,
    })
    .select()
    .single()
  if (squadErr) return NextResponse.json({ error: squadErr.message }, { status: 500 })

  const { error: pickErr } = await admin
    .from('squad_players')
    .insert(playerIds.map((pid) => ({ squad_id: squad.id, player_id: pid, is_starting: starterIds.includes(pid) })))
  if (pickErr) return NextResponse.json({ error: pickErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, spent, transfersUsed, gameweek: gameweek.label })
}
