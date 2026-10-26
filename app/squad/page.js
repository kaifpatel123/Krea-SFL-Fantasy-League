import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-server'
import { getManager } from '@/lib/manager'
import { TEST_MODE, BUDGET } from '@/lib/config'
import SquadBuilder from '@/components/SquadBuilder'
import { pointsForPlayerStat } from '@/lib/scoring'
import ManagerSetup from '@/components/ManagerSetup'
import EntryPayment from '@/components/EntryPayment'
import { getEntryFeePaise, hasPaidEntry, PAYMENT_REQUIRED } from '@/lib/payments'

export const dynamic = 'force-dynamic'

export default async function SquadPage() {
  const manager = await getManager()

  if (!manager) {
    if (!TEST_MODE) redirect('/login')
    return <ManagerSetup />
  }

  // First sign-in with Google: pick a team name before anything else.
  if (!manager.display_name) return <ManagerSetup signedIn />

  if (PAYMENT_REQUIRED && !(await hasPaidEntry(manager.id))) {
    const amountPaise = await getEntryFeePaise()
    const paymentConfigured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
    return (
      <div>
        <EntryPayment amountPaise={amountPaise} />
        {!paymentConfigured && (
          <p className="text-red-400 text-sm mt-4">Payments are not configured yet. Please contact the league admin.</p>
        )}
      </div>
    )
  }

  const supabase = createAdminClient()

  const [{ data: players }, { data: teams }, { data: gameweek }] = await Promise.all([
    supabase.from('players').select('*').order('fantasy_price', { ascending: false }),
    supabase.from('teams').select('*'),
    supabase
      .from('gameweeks')
      .select('*')
      .eq('is_locked', false)
      .order('match_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  // Season stats per player, from scored gameweeks only, with opponent and result for each gameweek.
  const [{ data: scoredGws }, { data: fixtures }] = await Promise.all([
    supabase.from('gameweeks').select('id, label, match_date').eq('is_scored', true).order('match_date', { ascending: true }),
    supabase.from('fixtures').select('*').eq('league', 'MSFL'),
  ])
  const scoredIds = (scoredGws || []).map((g) => g.id)
  const { data: statRows } = scoredIds.length
    ? await supabase.from('player_stats').select('*').in('gameweek_id', scoredIds)
    : { data: [] }

  const clubOf = {}
  ;(teams || []).forEach((t) => (clubOf[t.key] = t.club))
  const gwNo = (g) => Number(String(g?.label || '').replace(/[^0-9]/g, '')) || null
  const fixtureFor = (team, no) =>
    (fixtures || []).find((f) => f.gameweek_no === no && (f.home === team || f.away === team))

  const statKey = {}
  ;(statRows || []).forEach((s) => (statKey[`${s.player_id}:${s.gameweek_id}`] = s))

  function buildStats(p) {
    const history = []
    for (const g of scoredGws || []) {
      const no = gwNo(g)
      const fx = fixtureFor(p.auction_team, no)
      const s = statKey[`${p.id}:${g.id}`]
      if (!fx && !s) continue
      let opp = null
      let result = null
      if (fx) {
        const home = fx.home === p.auction_team
        opp = `${clubOf[home ? fx.away : fx.home] || (home ? fx.away : fx.home)} (${home ? 'H' : 'A'})`
        if (fx.home_goals != null && fx.away_goals != null) {
          const forG = home ? fx.home_goals : fx.away_goals
          const agG = home ? fx.away_goals : fx.home_goals
          result = `${forG > agG ? 'W' : forG < agG ? 'L' : 'D'} ${forG}-${agG}`
        }
      }
      history.push({
        gw: `GW${no}`,
        opp,
        result,
        played: !!(s && s.minutes_played > 0),
        goals: s?.goals || 0,
        assists: s?.assists || 0,
        cleanSheet: !!s?.clean_sheet,
        yellows: s?.yellow_cards || 0,
        reds: s?.red_cards || 0,
        motm: !!s?.motm,
        points: s ? pointsForPlayerStat(s, p.position) : 0,
      })
    }
    if (!history.length) return null
    const sum = (k) => history.reduce((a, h) => a + (typeof h[k] === 'boolean' ? (h[k] ? 1 : 0) : h[k]), 0)
    const apps = sum('played')
    const points = sum('points')
    return {
      history,
      apps,
      points,
      goals: sum('goals'),
      assists: sum('assists'),
      cleanSheets: sum('cleanSheet'),
      yellows: sum('yellows'),
      reds: sum('reds'),
      motm: sum('motm'),
      perMatch: apps ? Math.round((points / apps) * 10) / 10 : 0,
      form: history[history.length - 1].points,
    }
  }

  const openNo = gwNo(gameweek)
  const withClub = (players || []).map((p) => {
    const nf = openNo ? fixtureFor(p.auction_team, openNo) : null
    const nextHome = nf && nf.home === p.auction_team
    return {
      ...p,
      club: clubOf[p.auction_team] || p.auction_team || '',
      stats: buildStats(p),
      next: nf ? `${clubOf[nextHome ? nf.away : nf.home] || (nextHome ? nf.away : nf.home)} (${nextHome ? 'H' : 'A'})` : null,
    }
  })

  if (!gameweek) {
    return (
      <div className="pt-16 text-center">
        <p className="font-display text-3xl text-chalk mb-2">NO OPEN GAMEWEEK</p>
        <p className="text-chalk/60">Squad selection isn&apos;t open right now. Check back once the next matchday is announced.</p>
      </div>
    )
  }

  // Current squad for this gameweek, or carry over the most recent earlier squad.
  let existingSquad = null
  let existingPicks = []
  const { data: mySquads } = await supabase
    .from('squads')
    .select('*, gameweeks(match_date)')
    .eq('profile_id', manager.id)

  const current = (mySquads || []).find((s) => s.gameweek_id === gameweek.id)
  const previous = (mySquads || [])
    .filter((s) => s.gameweek_id !== gameweek.id && s.gameweeks?.match_date < gameweek.match_date)
    .sort((a, b) => (b.gameweeks?.match_date || '').localeCompare(a.gameweeks?.match_date || ''))[0]

  let baselineIds = null
  if (previous) {
    const { data: prevPicks } = await supabase.from('squad_players').select('player_id').eq('squad_id', previous.id)
    baselineIds = (prevPicks || []).map((p) => p.player_id)
  }

  const source = current || previous
  if (source) {
    existingSquad = source
    const { data: picks } = await supabase.from('squad_players').select('*').eq('squad_id', source.id)
    existingPicks = picks || []
  }

  return (
    <SquadBuilder
      players={withClub}
      gameweek={gameweek}
      manager={{ id: manager.id, name: manager.display_name }}
      existingSquad={existingSquad}
      existingPicks={existingPicks}
      savedForThisGw={!!current}
      budget={Number(manager.budget) || BUDGET}
      testMode={TEST_MODE}
      baselineIds={baselineIds}
    />
  )
}
