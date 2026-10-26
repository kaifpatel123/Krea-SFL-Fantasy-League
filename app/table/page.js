import { createClient } from '@/lib/supabase-server'
import { computeStandings } from '@/lib/standings'
import LeagueTabs from '@/components/LeagueTabs'
import PageHeader from '@/components/PageHeader'

export const dynamic = 'force-dynamic'

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
}

export default async function TablePage({ searchParams }) {
  const league = searchParams?.league === 'WSFL' ? 'WSFL' : 'MSFL'
  const supabase = await createClient()
  const [{ data: teams }, { data: fixtures }] = await Promise.all([
    supabase.from('teams').select('*'),
    supabase.from('fixtures').select('*').order('match_date', { ascending: true }).order('id', { ascending: true }),
  ])

  const clubOf = {}
  ;(teams || []).forEach((t) => (clubOf[t.key] = t.club))
  const table = computeStandings(fixtures || [], teams || [], league)
  const leagueFixtures = (fixtures || []).filter((f) => f.league === league)
  const byGw = {}
  leagueFixtures.forEach((f) => {
    ;(byGw[f.gameweek_no] = byGw[f.gameweek_no] || []).push(f)
  })
  const qualify = league === 'MSFL' ? 4 : 3

  return (
    <div>
      <PageHeader title="LEAGUE TABLE" sub="Standings, fixtures and results from the SIAS Football League.">
        <LeagueTabs league={league} base="/table" />
      </PageHeader>

      <div className="overflow-x-auto border border-white/10 bg-ink/40 mb-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-chalk/60 text-xs border-b border-white/10 bg-ink">
              <th className="px-3 py-3 w-10">#</th>
              <th className="px-3 py-3">Club</th>
              <th className="px-2 py-3 text-center">P</th>
              <th className="px-2 py-3 text-center">W</th>
              <th className="px-2 py-3 text-center">D</th>
              <th className="px-2 py-3 text-center">L</th>
              <th className="px-2 py-3 text-center">GF</th>
              <th className="px-2 py-3 text-center">GA</th>
              <th className="px-2 py-3 text-center">GD</th>
              <th className="px-3 py-3 text-center">Pts</th>
              <th className="px-3 py-3 hidden sm:table-cell">Form</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r, i) => (
              <tr key={r.key} className={`border-b border-white/5 ${i < qualify ? 'bg-gold/5' : ''}`}>
                <td className={`px-3 py-3 font-display text-lg scoreboard-num ${i < qualify ? 'text-gold border-l-4 border-gold' : 'text-chalk/60 border-l-4 border-transparent'}`}>{i + 1}</td>
                <td className="px-3 py-3">
                  <p className="text-chalk font-medium">{r.club}</p>
                  <p className="text-chalk/50 text-xs">{r.key}</p>
                </td>
                <Num v={r.p} />
                <Num v={r.w} />
                <Num v={r.d} />
                <Num v={r.l} />
                <Num v={r.gf} />
                <Num v={r.ga} />
                <Num v={r.gd > 0 ? `+${r.gd}` : r.gd} />
                <td className="px-3 py-3 text-center font-display text-lg text-gold scoreboard-num">{r.pts}</td>
                <td className="px-3 py-3 hidden sm:table-cell">
                  <div className="flex gap-1">
                    {r.form.slice(-5).map((f, j) => (
                      <span
                        key={j}
                        className={`w-5 h-5 text-[10px] font-bold flex items-center justify-center ${
                          f === 'W' ? 'bg-turf text-chalk' : f === 'D' ? 'bg-chalk/30 text-ink' : 'bg-red-700 text-chalk'
                        }`}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-chalk/50 text-xs mb-12">
        The gold rows (top {qualify}) qualify for the knockouts. Ties are split by goal difference, then fewest goals conceded.
      </p>

      <h2 className="font-display text-4xl md:text-5xl text-chalk mb-6">FIXTURES & RESULTS</h2>
      <div className="space-y-8">
        {Object.keys(byGw)
          .sort((a, b) => a - b)
          .map((gw) => (
            <div key={gw}>
              <p className="font-display text-gold tracking-wider mb-2">GAMEWEEK {gw}</p>
              <div className="border border-white/10 bg-ink/40 divide-y divide-white/5">
                {byGw[gw].map((f) => {
                  const played = f.home_goals !== null && f.away_goals !== null
                  return (
                    <div key={f.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-3 text-sm">
                      <span className="text-right text-chalk">{clubOf[f.home] || f.home}</span>
                      <span
                        className={`font-display text-center min-w-[72px] px-2 py-1 scoreboard-num ${
                          played ? 'bg-ink text-gold text-lg' : 'text-chalk/50 text-xs'
                        }`}
                      >
                        {played ? `${f.home_goals} - ${f.away_goals}` : `${fmtDate(f.match_date)} ${f.kickoff || ''}`}
                      </span>
                      <span className="text-chalk">{clubOf[f.away] || f.away}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function Num({ v }) {
  return <td className="px-2 py-3 text-center text-chalk/80 scoreboard-num">{v}</td>
}
