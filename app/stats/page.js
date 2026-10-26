import { createClient } from '@/lib/supabase-server'
import LeagueTabs from '@/components/LeagueTabs'
import PageHeader from '@/components/PageHeader'

export const dynamic = 'force-dynamic'

export default async function StatsPage({ searchParams }) {
  const league = searchParams?.league === 'WSFL' ? 'WSFL' : 'MSFL'
  const supabase = await createClient()
  const { data: teams } = await supabase.from('teams').select('*')
  const clubOf = {}
  ;(teams || []).forEach((t) => (clubOf[t.key] = t.club))

  let rows = []
  if (league === 'MSFL') {
    const [{ data: stats }, { data: players }] = await Promise.all([
      supabase.from('player_stats').select('player_id, goals, assists, yellow_cards, red_cards, motm, minutes_played'),
      supabase.from('players').select('id, name, position, auction_team'),
    ])
    const pmap = {}
    ;(players || []).forEach((p) => (pmap[p.id] = p))
    const agg = {}
    ;(stats || []).forEach((s) => {
      const p = pmap[s.player_id]
      if (!p) return
      const r = (agg[s.player_id] = agg[s.player_id] || {
        name: p.name,
        position: p.position,
        club: clubOf[p.auction_team] || p.auction_team,
        goals: 0,
        assists: 0,
        yellow: 0,
        red: 0,
        motm: 0,
        apps: 0,
      })
      r.goals += s.goals || 0
      r.assists += s.assists || 0
      r.yellow += s.yellow_cards || 0
      r.red += s.red_cards || 0
      r.motm += s.motm ? 1 : 0
      r.apps += s.minutes_played > 0 ? 1 : 0
    })
    rows = Object.values(agg)
  } else {
    const { data: ws } = await supabase.from('wsfl_stats').select('*')
    rows = (ws || []).map((s) => ({
      name: s.name,
      club: clubOf[s.team] || s.team,
      goals: s.goals || 0,
      assists: s.assists || 0,
      yellow: s.yellow_cards || 0,
      red: s.red_cards || 0,
    }))
  }

  const top = (key) =>
    rows
      .filter((r) => r[key] > 0)
      .sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name))
  const scorers = top('goals')
  const assisters = top('assists')
  const ga = rows
    .map((r) => ({ ...r, ga: r.goals + r.assists }))
    .filter((r) => r.ga > 0)
    .sort((a, b) => b.ga - a.ga || b.goals - a.goals || a.name.localeCompare(b.name))
  const cards = rows
    .filter((r) => r.yellow + r.red > 0)
    .sort((a, b) => b.red - a.red || b.yellow - a.yellow || a.name.localeCompare(b.name))

  return (
    <div>
      <PageHeader title="PLAYER STATS" sub="Who's scoring, creating and collecting cards this season." photo="/photos/floodlight.webp">
        <LeagueTabs league={league} base="/stats" />
      </PageHeader>

      <div className="grid md:grid-cols-2 gap-8">
        <StatList title="TOP SCORERS" rows={scorers} value={(r) => r.goals} unit="G" />
        <StatList title="MOST ASSISTS" rows={assisters} value={(r) => r.assists} unit="A" />
        <StatList title="GOAL CONTRIBUTIONS" rows={ga} value={(r) => r.ga} unit="G+A" />
        <StatList
          title="DISCIPLINE"
          rows={cards}
          value={(r) => (
            <span className="flex gap-2 items-center">
              {r.yellow > 0 && <Card color="bg-yellow-400" n={r.yellow} />}
              {r.red > 0 && <Card color="bg-red-600" n={r.red} />}
            </span>
          )}
        />
      </div>
    </div>
  )
}

function Card({ color, n }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block w-3 h-4 ${color}`} />
      <span className="scoreboard-num">{n}</span>
    </span>
  )
}

function StatList({ title, rows, value, unit }) {
  return (
    <div className="border border-white/10 bg-ink/40">
      <p className="font-display text-2xl text-chalk px-4 py-3 border-b border-white/10 bg-ink">{title}</p>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-chalk/50 text-sm">Nothing yet.</p>
      ) : (
        <ol>
          {rows.slice(0, 10).map((r, i) => (
            <li key={r.name + i} className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0 ${i === 0 ? 'bg-gold/10' : ''}`}>
              <span className={`w-5 font-display scoreboard-num ${i === 0 ? 'text-gold' : 'text-chalk/50'}`}>{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="text-chalk block truncate">{r.name}</span>
                <span className="text-chalk/50 text-xs">
                  {r.club}
                  {r.position ? ` · ${r.position}` : ''}
                </span>
              </span>
              <span className="font-display text-xl text-chalk scoreboard-num flex items-baseline gap-1">
                {value(r)}
                {unit && <span className="text-xs text-chalk/40">{unit}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
