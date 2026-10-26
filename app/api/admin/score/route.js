import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/manager'
import { computeSquadPoints } from '@/lib/scoring'
import { transferHit } from '@/lib/config'

// Work out every squad's points for a gameweek from the entered player stats.
export async function POST(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const { gameweekId } = await request.json().catch(() => ({}))
  if (!gameweekId) return NextResponse.json({ error: 'Missing gameweek' }, { status: 400 })

  const admin = createAdminClient()
  const [{ data: squads }, { data: players }, { data: stats }] = await Promise.all([
    admin.from('squads').select('*').eq('gameweek_id', gameweekId),
    admin.from('players').select('id, name, position'),
    admin.from('player_stats').select('*').eq('gameweek_id', gameweekId),
  ])

  const playerMap = {}
  ;(players || []).forEach((p) => (playerMap[p.id] = p))
  const statMap = {}
  ;(stats || []).forEach((s) => (statMap[s.player_id] = s))

  const squadIds = (squads || []).map((s) => s.id)
  let picks = []
  if (squadIds.length) {
    const { data } = await admin.from('squad_players').select('*').in('squad_id', squadIds)
    picks = data || []
  }

  const rows = (squads || []).map((sq) => {
    const { total, breakdown } = computeSquadPoints({
      squadPlayers: picks.filter((p) => p.squad_id === sq.id),
      players: playerMap,
      stats: statMap,
      captainId: sq.captain_id,
      viceCaptainId: sq.vice_captain_id,
    })
    const hit = transferHit(sq.transfers_used)
    if (hit) breakdown.push({ transfer_hit: true, name: `Transfer hit (${sq.transfers_used} transfers)`, points: -hit })
    return {
      squad_id: sq.id,
      gameweek_id: gameweekId,
      points: total - hit,
      breakdown,
      computed_at: new Date().toISOString(),
    }
  })

  if (rows.length) {
    const { error } = await admin.from('squad_points').upsert(rows, { onConflict: 'squad_id,gameweek_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  await admin.from('gameweeks').update({ is_scored: true, is_locked: true }).eq('id', gameweekId)

  return NextResponse.json({ ok: true, squads: rows.length })
}
