import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-server'
import LeagueTabs from '@/components/LeagueTabs'

export const dynamic = 'force-dynamic'

// A manager's squads, shown only for gameweeks that have been scored.
// Squads for open or in-progress gameweeks stay hidden from everyone else.
export default async function ManagerPage({ params, searchParams }) {
  const league = searchParams?.league === 'WSFL' ? 'WSFL' : 'MSFL'
  const admin = createAdminClient()

  const { data: profile } = await admin.from('profiles').select('id, display_name').eq('id', params.id).maybeSingle()
  if (!profile) notFound()

  const { data: gameweeks } = await admin
    .from('gameweeks')
    .select('id, label, match_date')
    .eq('is_scored', true)
    .order('match_date', { ascending: false })
  const scoredIds = (gameweeks || []).map((g) => g.id)

  let squads = []
  let picks = []
  let points = []
  if (scoredIds.length) {
    const { data } = await admin
      .from('squads')
      .select('id, gameweek_id, captain_id, vice_captain_id, transfers_used')
      .eq('profile_id', profile.id)
      .eq('league', league)
      .in('gameweek_id', scoredIds)
    squads = data || []
  }
  const squadIds = squads.map((s) => s.id)
  if (squadIds.length) {
    const [{ data: sp }, { data: pts }] = await Promise.all([
      admin.from('squad_players').select('squad_id, player_id, is_starting').in('squad_id', squadIds),
      admin.from('squad_points').select('squad_id, points, breakdown').in('squad_id', squadIds),
    ])
    picks = sp || []
    points = pts || []
  }

  const playerIds = Array.from(new Set(picks.map((p) => p.player_id)))
  const { data: players } = playerIds.length
    ? await admin.from('players').select('id, name, position').in('id', playerIds)
    : { data: [] }
  const playerMap = {}
  ;(players || []).forEach((p) => (playerMap[p.id] = p))

  const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 }

  return (
    <div className="pt-6">
      <Link href={`/leaderboard?league=${league}`} className="text-chalk/50 text-sm hover:text-gold">
        ← Fantasy table
      </Link>
      <h1 className="font-display text-4xl text-chalk mt-2 mb-2">{(profile.display_name || '').toUpperCase()}</h1>
      <p className="text-gold text-xs font-display tracking-widest mb-3">
        {league === 'MSFL' ? "MEN'S FANTASY" : "WOMEN'S FANTASY"}
      </p>
      <div className="mb-5">
        <LeagueTabs league={league} base={`/manager/${profile.id}`} />
      </div>
      <p className="text-chalk/60 mb-8">Squads appear here once a gameweek has been scored.</p>

      {(gameweeks || []).filter((g) => squads.some((s) => s.gameweek_id === g.id)).length === 0 && (
        <p className="text-chalk/60">No scored gameweeks for this manager yet.</p>
      )}

      <div className="space-y-8">
        {(gameweeks || []).map((g) => {
          const squad = squads.find((s) => s.gameweek_id === g.id)
          if (!squad) return null
          const sp = points.find((p) => p.squad_id === squad.id)
          const ptsByPlayer = {}
          let hitRow = null
          ;(sp?.breakdown || []).forEach((b) => {
            if (b.transfer_hit) hitRow = b
            else ptsByPlayer[b.player_id] = b.points
          })
          const list = picks
            .filter((p) => p.squad_id === squad.id)
            .map((p) => playerMap[p.player_id] && { ...playerMap[p.player_id], sub: p.is_starting === false })
            .filter(Boolean)
            .sort((a, b) => a.sub - b.sub || order[a.position] - order[b.position])

          return (
            <div key={g.id}>
              <div className="flex items-end justify-between mb-2">
                <p className="font-display text-gold tracking-wider">{g.label.toUpperCase()}</p>
                <p className="font-display text-2xl text-chalk scoreboard-num">{sp?.points ?? '-'} PTS</p>
              </div>
              <div className="border border-white/10 divide-y divide-white/5 text-sm">
                {list.map((p) => (
                  <div key={p.id} className={`flex items-center gap-3 px-4 py-2 ${p.sub ? 'opacity-60' : ''}`}>
                    <span className="text-chalk/50 w-10 text-xs">{p.position}</span>
                    <span className="text-chalk flex-1">
                      {p.name}
                      {squad.captain_id === p.id && <span className="ml-2 text-xs bg-gold text-ink px-1.5">C</span>}
                      {squad.vice_captain_id === p.id && <span className="ml-2 text-xs border border-gold text-gold px-1.5">VC</span>}
                      {p.sub && <span className="ml-2 text-xs border border-white/20 text-chalk/60 px-1.5">SUB</span>}
                    </span>
                    <span className="text-chalk/80 scoreboard-num">{ptsByPlayer[p.id] ?? 0}</span>
                  </div>
                ))}
                {hitRow && (
                  <div className="flex items-center gap-3 px-4 py-2 text-red-300">
                    <span className="flex-1">{hitRow.name}</span>
                    <span className="scoreboard-num">{hitRow.points}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
