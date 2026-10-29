import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/manager'

const FIELDS = [
  'minutes_played',
  'goals',
  'assists',
  'clean_sheet',
  'goals_conceded',
  'yellow_cards',
  'red_cards',
  'own_goals',
  'motm',
]

// Replace all player stats for one gameweek with the rows sent.
export async function POST(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const { gameweekId, league, rows } = await request.json().catch(() => ({}))
  if (!gameweekId || !['MSFL', 'WSFL'].includes(league) || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const clean = rows
    .filter((r) => r.player_id)
    .map((r) => {
      const out = { gameweek_id: gameweekId, player_id: r.player_id }
      FIELDS.forEach((f) => {
        if (f === 'clean_sheet' || f === 'motm') out[f] = !!r[f]
        else out[f] = Math.max(0, parseInt(r[f], 10) || 0)
      })
      return out
    })

  const admin = createAdminClient()
  const { data: leaguePlayers, error: playersErr } = await admin.from('players').select('id').eq('league', league)
  if (playersErr) return NextResponse.json({ error: playersErr.message }, { status: 500 })
  const leaguePlayerIds = (leaguePlayers || []).map((p) => p.id)
  const validPlayerIds = new Set(leaguePlayerIds)
  if (clean.some((row) => !validPlayerIds.has(row.player_id))) {
    return NextResponse.json({ error: `Stats can only be saved for ${league} players` }, { status: 400 })
  }
  const keep = clean.map((r) => r.player_id)

  if (leaguePlayerIds.length) {
    let del = admin.from('player_stats').delete().eq('gameweek_id', gameweekId).in('player_id', leaguePlayerIds)
    if (keep.length) del = del.not('player_id', 'in', `(${keep.join(',')})`)
    const { error: delErr } = await del
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  if (clean.length) {
    const { error } = await admin.from('player_stats').upsert(clean, { onConflict: 'gameweek_id,player_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, saved: clean.length })
}
