import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { TEST_MODE } from '@/lib/config'

export const dynamic = 'force-dynamic'

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default async function Home() {
  const supabase = await createClient()
  const [{ data: gameweeks }, { data: fixtures }, { data: teams }, { data: profiles }, { data: squads }, { data: points }] =
    await Promise.all([
      supabase.from('gameweeks').select('*').order('match_date', { ascending: true }),
      supabase.from('fixtures').select('*').eq('league', 'MSFL'),
      supabase.from('teams').select('*'),
      supabase.from('profiles').select('id, display_name, email'),
      supabase.from('squads').select('id, profile_id'),
      supabase.from('squad_points').select('squad_id, points'),
    ])

  const clubOf = {}
  ;(teams || []).forEach((t) => (clubOf[t.key] = t.club))
  const openGw = (gameweeks || []).find((g) => !g.is_locked)
  const openNo = Number(String(openGw?.label || '').replace(/[^0-9]/g, '')) || null
  const openFixtures = (fixtures || []).filter((f) => f.gameweek_no === openNo)

  const played = (fixtures || []).filter((f) => f.home_goals != null && f.away_goals != null)
  const lastNo = played.reduce((m, f) => Math.max(m, f.gameweek_no), 0)
  const latest = played.filter((f) => f.gameweek_no === lastNo)

  const squadOwner = {}
  ;(squads || []).forEach((s) => (squadOwner[s.id] = s.profile_id))
  const totals = {}
  ;(profiles || [])
    .filter((p) => p.display_name && (TEST_MODE || !(p.email || '').endsWith('@fsfl.test')))
    .forEach((p) => (totals[p.id] = { id: p.id, name: p.display_name, total: 0 }))
  ;(points || []).forEach((sp) => {
    const t = totals[squadOwner[sp.squad_id]]
    if (t) t.total += sp.points
  })
  const top = Object.values(totals)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .slice(0, 5)
  const anyPoints = (points || []).length > 0

  return (
    <div>
      {/* Hero: the floodlit match, full bleed */}
      <section className="duotone relative left-1/2 -ml-[50vw] w-screen min-h-[86vh] flex items-end -mt-px">
        <img
          src="/photos/match-attack.webp"
          alt="SFL players attacking on the small turf under floodlights"
          className="absolute inset-0 w-full h-full object-cover object-[60%_50%]"
        />
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 pb-12 pt-28 grid lg:grid-cols-[1fr_340px] gap-10 items-end">
          <div>
            <p className="rise text-gold text-sm md:text-base mb-4">SIAS Football League 2026-27 fantasy</p>
            <h1 className="rise rise-2 font-display text-chalk leading-[0.86] text-[16vw] sm:text-[12vw] lg:text-[8.5rem]">
              PICK EIGHT.
              <br />
              <span className="text-outline">OWN THE</span>
              <br />
              WEEKEND.
            </h1>
            <p className="rise rise-3 text-chalk/80 text-lg max-w-lg mt-6">
              Build a squad from the real SFL auction, with real prices and a 100-credit budget. Every goal, clean sheet and
              card on the turf scores for you.
            </p>
            <div className="rise rise-3 flex flex-wrap gap-3 mt-8">
              <Link href="/squad" className="bg-gold text-ink font-display text-xl tracking-wide px-7 py-3 hover:bg-chalk transition-colors">
                {TEST_MODE ? 'PICK YOUR SQUAD' : 'JOIN THE LEAGUE'}
              </Link>
              <Link
                href="#how"
                className="border-2 border-chalk/40 text-chalk font-display text-xl tracking-wide px-7 py-3 hover:border-gold hover:text-gold transition-colors"
              >
                HOW IT WORKS
              </Link>
            </div>
          </div>

          {openGw && (
            <aside className="rise rise-3 bg-ink/80 backdrop-blur border-l-4 border-gold p-5">
              <p className="text-chalk/60 text-sm">Picks are open for</p>
              <p className="font-display text-4xl text-chalk mt-1">{openGw.label.toUpperCase()}</p>
              <p className="text-gold mt-1">{fmtDate(openGw.match_date)}. Squads lock at first kickoff.</p>
              {openFixtures.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-sm">
                  {openFixtures.map((f) => (
                    <li key={f.id} className="flex justify-between gap-3 text-chalk/85">
                      <span className="truncate">
                        {clubOf[f.home] || f.home} <span className="text-chalk/40">v</span> {clubOf[f.away] || f.away}
                      </span>
                      <span className="text-chalk/50 shrink-0">{f.kickoff}</span>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          )}
        </div>
      </section>

      {/* Latest results, scoreboard style */}
      {latest.length > 0 && (
        <section className="relative left-1/2 -ml-[50vw] w-screen bg-gold text-ink">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-6 overflow-x-auto no-scrollbar">
            <p className="font-display text-lg shrink-0">GW{lastNo} RESULTS</p>
            {latest.map((f) => (
              <div key={f.id} className="flex items-center gap-2 shrink-0 text-sm font-medium">
                <span>{clubOf[f.home] || f.home}</span>
                <span className="bg-ink text-gold font-display text-base px-2 py-0.5 scoreboard-num">
                  {f.home_goals}-{f.away_goals}
                </span>
                <span>{clubOf[f.away] || f.away}</span>
              </div>
            ))}
            <Link href="/table" className="ml-auto shrink-0 text-sm underline underline-offset-4 hover:no-underline">
              Full table
            </Link>
          </div>
        </section>
      )}

      {/* How it works: an actual sequence */}
      <section id="how" className="py-20 scroll-mt-16">
        <h2 className="font-display text-5xl md:text-6xl text-chalk mb-12">HOW IT WORKS</h2>
        <ol className="grid md:grid-cols-3 gap-px bg-white/10 border border-white/10">
          <Step n="1" title="Pick 8, start 6">
            1 goalkeeper, 3 defenders, 3 midfielders and 1 forward, inside 100 credits. Your goalkeeper and 5 others start;
            the 2 subs don&apos;t score.
          </Step>
          <Step n="2" title="Choose a captain">
            Your captain scores double. If they don&apos;t play, your vice-captain gets the double instead.
          </Step>
          <Step n="3" title="Score every gameweek">
            Save your squad before the deadline and it locks for that gameweek. One free transfer a week, and each extra one costs 4 points.
          </Step>
        </ol>
      </section>

      {/* Floodlight photo + scoring card */}
      <section className="grid lg:grid-cols-2 gap-0 border border-white/10">
        <div className="duotone min-h-[320px] lg:min-h-full">
          <img
            src="/photos/floodlight.webp"
            alt="An SFL match at night under the turf floodlight"
            className="absolute inset-0 w-full h-full object-cover object-[50%_30%]"
          />
          <p className="absolute z-10 left-6 bottom-6 font-display text-5xl md:text-6xl text-chalk leading-[0.9]">
            EVERY
            <br />
            TOUCH
            <br />
            <span className="text-gold">COUNTS.</span>
          </p>
        </div>
        <div className="bg-ink p-6 md:p-10">
          <h2 className="font-display text-3xl text-chalk mb-6">HOW POINTS WORK</h2>
          <dl className="text-sm">
            <Row k="Playing in the match" v="+1" />
            <Row k="Goal by a goalkeeper or defender" v="+6" />
            <Row k="Goal by a midfielder" v="+5" />
            <Row k="Goal by a forward" v="+4" />
            <Row k="Assist" v="+3" />
            <Row k="Clean sheet, goalkeeper or defender" v="+4" />
            <Row k="Clean sheet, midfielder" v="+1" />
            <Row k="Man of the match" v="+3" />
            <Row k="Every 2 goals conceded, goalkeeper or defender" v="-1" neg />
            <Row k="Yellow card" v="-1" neg />
            <Row k="Red card" v="-3" neg />
            <Row k="Own goal" v="-2" neg />
            <Row k="Each transfer after your free one" v="-4" neg />
          </dl>
        </div>
      </section>

      {/* Fantasy table preview */}
      <section className="pt-20">
        <div className="flex items-end justify-between gap-4 mb-6">
          <h2 className="font-display text-5xl md:text-6xl text-chalk">FANTASY TABLE</h2>
          <Link href="/leaderboard" className="text-gold underline underline-offset-4 hover:no-underline shrink-0">
            See everyone
          </Link>
        </div>
        {!anyPoints ? (
          <p className="text-chalk/60 border border-white/10 px-5 py-8">
            The table fills up after the first scored gameweek. Get your squad in before the deadline.
          </p>
        ) : (
          <ol className="border border-white/10 divide-y divide-white/10">
            {top.map((m, i) => (
              <li key={m.id}>
                <Link
                  href={`/manager/${m.id}`}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-white/5 ${i === 0 ? 'bg-gold/10' : ''}`}
                >
                  <span className={`font-display text-3xl w-8 scoreboard-num ${i === 0 ? 'text-gold' : 'text-chalk/40'}`}>{i + 1}</span>
                  <span className="flex-1 text-chalk text-lg truncate">{m.name}</span>
                  <span className="font-display text-3xl text-chalk scoreboard-num">{m.total}</span>
                  <span className="text-chalk/50 text-sm">pts</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <li className="bg-pitch p-6 md:p-8">
      <p className="font-display text-7xl text-outline leading-none">{n}</p>
      <h3 className="font-display text-2xl text-chalk mt-4">{title.toUpperCase()}</h3>
      <p className="text-chalk/70 mt-2">{children}</p>
    </li>
  )
}

function Row({ k, v, neg }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/10 py-2.5">
      <dt className="text-chalk/80">{k}</dt>
      <dd className={`font-display text-lg scoreboard-num ${neg ? 'text-turf' : 'text-gold'}`}>{v}</dd>
    </div>
  )
}
