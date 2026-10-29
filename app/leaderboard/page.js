import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { TEST_MODE } from '@/lib/config'
import PageHeader from '@/components/PageHeader'
import LeagueTabs from '@/components/LeagueTabs'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage({ searchParams }) {
  const league = searchParams?.league === 'WSFL' ? 'WSFL' : 'MSFL'
  const supabase = await createClient()

  const [{ data: profiles }, { data: squadPoints }, { data: squads }, { data: gameweeks }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, email'),
    supabase.from('squad_points').select('squad_id, gameweek_id, points'),
    supabase.from('squads').select('id, profile_id, gameweek_id, league').eq('league', league),
    supabase.from('gameweeks').select('id, label, is_scored').order('match_date', { ascending: true }),
  ])

  const squadMap = {}
  ;(squads || []).forEach((s) => (squadMap[s.id] = s))

  const totals = {}
  ;(profiles || [])
    .filter((p) => p.display_name)
    .filter((p) => TEST_MODE || !(p.email || '').endsWith('@fsfl.test'))
    .forEach((p) => (totals[p.id] = { id: p.id, name: p.display_name, total: 0, byGw: {} }))

  ;(squadPoints || []).forEach((sp) => {
    const squad = squadMap[sp.squad_id]
    if (!squad || squad.league !== league) return
    const entry = totals[squad.profile_id]
    if (!entry) return
    entry.total += sp.points
    entry.byGw[sp.gameweek_id] = sp.points
  })

  const ranked = Object.values(totals).sort((a, b) => b.total - a.total || (a.name || '').localeCompare(b.name || ''))
  const withPoints = new Set(
    (squadPoints || [])
      .filter((sp) => squadMap[sp.squad_id]?.league === league)
      .map((sp) => sp.gameweek_id)
  )
  const scoredGws = (gameweeks || []).filter((g) => g.is_scored && withPoints.has(g.id))

  return (
    <div>
      <PageHeader
        title="FANTASY TABLE"
        sub="Every manager's points across the scored gameweeks. Tap a manager to see their squads once a gameweek is scored."
      >
        <LeagueTabs league={league} base="/leaderboard" />
      </PageHeader>

      {ranked.length === 0 ? (
        <p className="text-chalk/60">No managers yet. Be the first to pick a squad.</p>
      ) : (
        <div className="overflow-x-auto border border-white/10 bg-ink/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-chalk/60 text-xs border-b border-white/10 bg-ink">
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Manager</th>
                {scoredGws.map((g) => (
                  <th key={g.id} className="px-3 py-3 text-center">
                    {g.label.replace('Gameweek ', 'GW')}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => (
                <tr key={r.id} className={`border-b border-white/5 ${i === 0 ? 'bg-gold/10' : ''}`}>
                  <td className={`px-4 py-3 font-display text-xl scoreboard-num ${i < 3 ? 'text-gold' : 'text-chalk/60'}`}>{i + 1}</td>
                  <td className="px-4 py-3 text-chalk">
                    <Link href={`/manager/${r.id}?league=${league}`} className="hover:text-gold underline-offset-4 hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  {scoredGws.map((g) => (
                    <td key={g.id} className="px-3 py-3 text-center text-chalk/80 scoreboard-num">
                      {r.byGw[g.id] ?? '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-display text-lg text-gold scoreboard-num">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
