'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminPayments from '@/components/AdminPayments'

const TABS = ['Results', 'Player Stats', 'Gameweeks', 'Payments']
const NUM_FIELDS = [
  ['minutes_played', 'Played', 'Tick if they played'],
  ['goals', 'G'],
  ['assists', 'A'],
  ['goals_conceded', 'GC'],
  ['yellow_cards', 'YC'],
  ['red_cards', 'RC'],
  ['own_goals', 'OG'],
]

async function call(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Request failed')
  return json
}

export default function AdminPanel({ gameweeks, players, fixtures, teams, stats }) {
  const [tab, setTab] = useState('Results')
  const router = useRouter()

  async function logout() {
    await fetch('/api/admin/login', { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="pt-4">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <h1 className="font-display text-4xl text-chalk">ADMIN</h1>
        <button onClick={logout} className="text-chalk/50 text-sm underline hover:text-gold">
          Log out of admin
        </button>
      </div>
      <div className="flex border border-white/10 mb-8 w-fit max-w-full overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 font-display tracking-wider text-sm shrink-0 ${
              tab === t ? 'bg-gold text-ink' : 'text-chalk/70 hover:text-gold'
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>
      {tab === 'Results' && <Results fixtures={fixtures} teams={teams} />}
      {tab === 'Player Stats' && <StatsEditor gameweeks={gameweeks} players={players} stats={stats} teams={teams} />}
      {tab === 'Gameweeks' && <Gameweeks gameweeks={gameweeks} />}
      {tab === 'Payments' && <AdminPayments />}
    </div>
  )
}

function Results({ fixtures, teams }) {
  const clubOf = useMemo(() => {
    const m = {}
    teams.forEach((t) => (m[t.key] = t.club))
    return m
  }, [teams])
  const [league, setLeague] = useState('MSFL')
  const list = fixtures.filter((f) => f.league === league)
  const byGw = {}
  list.forEach((f) => (byGw[f.gameweek_no] = byGw[f.gameweek_no] || []).push(f))

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {['MSFL', 'WSFL'].map((l) => (
          <button
            key={l}
            onClick={() => setLeague(l)}
            className={`px-3 py-1.5 text-xs font-display tracking-wider border ${
              league === l ? 'bg-chalk text-ink border-chalk' : 'border-white/15 text-chalk/70'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="space-y-8">
        {Object.keys(byGw)
          .sort((a, b) => a - b)
          .map((gw) => (
            <div key={gw}>
              <p className="font-display text-gold tracking-wider mb-2">GAMEWEEK {gw}</p>
              <div className="border border-white/10 divide-y divide-white/5">
                {byGw[gw].map((f) => (
                  <ResultRow key={f.id} f={f} home={clubOf[f.home] || f.home} away={clubOf[f.away] || f.away} />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function ResultRow({ f, home, away }) {
  const router = useRouter()
  const [h, setH] = useState(f.home_goals ?? '')
  const [a, setA] = useState(f.away_goals ?? '')
  const [state, setState] = useState(null)
  const dirty = String(h) !== String(f.home_goals ?? '') || String(a) !== String(f.away_goals ?? '')

  async function save() {
    setState('saving')
    try {
      await call('/api/admin/fixtures', 'PATCH', { id: f.id, home_goals: h, away_goals: a })
      setState('saved')
      router.refresh()
    } catch (e) {
      setState(e.message)
    }
  }

  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 px-3 py-2 text-sm">
      <span className="text-right text-chalk truncate">{home}</span>
      <span className="flex items-center gap-1">
        <ScoreInput value={h} onChange={setH} />
        <span className="text-chalk/40">-</span>
        <ScoreInput value={a} onChange={setA} />
      </span>
      <span className="text-chalk truncate">{away}</span>
      <span className="w-20 text-right">
        {dirty ? (
          <button onClick={save} className="bg-gold text-ink text-xs font-display px-3 py-1">
            {state === 'saving' ? '...' : 'SAVE'}
          </button>
        ) : state === 'saved' ? (
          <span className="text-turf text-xs">Saved</span>
        ) : state && state !== 'saving' ? (
          <span className="text-red-400 text-xs">{state}</span>
        ) : null}
      </span>
    </div>
  )
}

function ScoreInput({ value, onChange }) {
  return (
    <input
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
      className="w-10 bg-ink border border-white/20 text-center py-1 text-chalk font-display scoreboard-num focus:border-gold outline-none"
    />
  )
}

const blankRow = (id) => ({
  player_id: id,
  minutes_played: 1,
  goals: 0,
  assists: 0,
  goals_conceded: 0,
  yellow_cards: 0,
  red_cards: 0,
  own_goals: 0,
  clean_sheet: false,
  motm: false,
})

function StatsEditor({ gameweeks, players, stats, teams }) {
  const router = useRouter()
  const clubOf = useMemo(() => {
    const m = {}
    teams.forEach((t) => (m[t.key] = t.club))
    return m
  }, [teams])
  const playerMap = useMemo(() => {
    const m = {}
    players.forEach((p) => (m[p.id] = p))
    return m
  }, [players])

  const [league, setLeague] = useState('MSFL')
  const [gwId, setGwId] = useState(gameweeks[0]?.id || null)
  const rowsFor = (id, selectedLeague = league) =>
    stats
      .filter((s) => s.gameweek_id === id && playerMap[s.player_id]?.league === selectedLeague)
      .map((s) => ({ ...s, minutes_played: s.minutes_played > 0 ? 1 : 0 }))
  const [rows, setRows] = useState(() => rowsFor(gameweeks[0]?.id))
  const [addTeam, setAddTeam] = useState('ALL')
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)

  function pickGw(id) {
    setGwId(id)
    setRows(rowsFor(id))
    setMsg(null)
  }

  function pickLeague(nextLeague) {
    setLeague(nextLeague)
    setRows(rowsFor(gwId, nextLeague))
    setAddTeam('ALL')
    setMsg(null)
  }

  function update(i, field, value) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [field]: value } : r)))
  }

  function addPlayers(ids) {
    setRows((rs) => {
      const have = new Set(rs.map((r) => r.player_id))
      return [...rs, ...ids.filter((id) => id && !have.has(id)).map(blankRow)]
    })
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await call('/api/admin/stats', 'POST', { gameweekId: gwId, league, rows })
      setMsg({ ok: true, text: `Saved ${res.saved} player rows.` })
      router.refresh()
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    }
    setSaving(false)
  }

  const leaguePlayers = players.filter((p) => p.league === league)
  const options = leaguePlayers.filter((p) => addTeam === 'ALL' || p.auction_team === addTeam)
  const teamKeys = teams.filter((t) => t.league === league).map((t) => t.key)

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {['MSFL', 'WSFL'].map((value) => (
          <button
            key={value}
            onClick={() => pickLeague(value)}
            className={`px-3 py-1.5 text-xs font-display tracking-wider border ${
              league === value ? 'bg-gold text-ink border-gold' : 'border-white/15 text-chalk/70'
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {gameweeks.map((g) => (
          <button
            key={g.id}
            onClick={() => pickGw(g.id)}
            className={`px-3 py-1.5 text-xs font-display tracking-wider border ${
              gwId === g.id ? 'bg-chalk text-ink border-chalk' : 'border-white/15 text-chalk/70'
            }`}
          >
            {g.label.replace('Gameweek ', 'GW')}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select
          value={addTeam}
          onChange={(e) => setAddTeam(e.target.value)}
          className="bg-ink border border-white/15 px-2 py-2 text-sm text-chalk"
        >
          <option value="ALL">All teams</option>
          {teamKeys.map((k) => (
            <option key={k} value={k}>
              {clubOf[k]} ({k})
            </option>
          ))}
        </select>
        <select
          value=""
          onChange={(e) => addPlayers([e.target.value])}
          className="bg-ink border border-white/15 px-2 py-2 text-sm text-chalk min-w-[200px]"
        >
          <option value="">+ Add a player</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.position})
            </option>
          ))}
        </select>
        {addTeam !== 'ALL' && (
          <button
            onClick={() => addPlayers(options.map((p) => p.id))}
            className="border border-white/20 text-chalk/80 text-sm px-3 py-2 hover:text-gold"
          >
            Add whole squad
          </button>
        )}
      </div>

      <div className="overflow-x-auto border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-chalk/60 text-xs uppercase tracking-wider border-b border-white/10">
              <th className="px-3 py-2 text-left">Player</th>
              {NUM_FIELDS.map(([f, label]) => (
                <th key={f} className="px-1 py-2">
                  {label}
                </th>
              ))}
              <th className="px-1 py-2">CS</th>
              <th className="px-1 py-2">MOTM</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const p = playerMap[r.player_id]
              return (
                <tr key={r.player_id} className="border-b border-white/5">
                  <td className="px-3 py-1.5">
                    <span className="text-chalk">{p?.name}</span>
                    <span className="text-chalk/40 text-xs ml-2">
                      {p?.position} · {clubOf[p?.auction_team] || p?.auction_team}
                    </span>
                  </td>
                  {NUM_FIELDS.map(([f]) =>
                    f === 'minutes_played' ? (
                      <td key={f} className="px-1 text-center">
                        <input
                          type="checkbox"
                          checked={r.minutes_played > 0}
                          onChange={(e) => update(i, f, e.target.checked ? 1 : 0)}
                        />
                      </td>
                    ) : (
                      <td key={f} className="px-1 text-center">
                        <input
                          inputMode="numeric"
                          value={r[f] ?? 0}
                          onChange={(e) => update(i, f, e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                          className="w-10 bg-ink border border-white/15 text-center py-1 text-chalk scoreboard-num"
                        />
                      </td>
                    )
                  )}
                  <td className="px-1 text-center">
                    <input type="checkbox" checked={!!r.clean_sheet} onChange={(e) => update(i, 'clean_sheet', e.target.checked)} />
                  </td>
                  <td className="px-1 text-center">
                    <input type="checkbox" checked={!!r.motm} onChange={(e) => update(i, 'motm', e.target.checked)} />
                  </td>
                  <td className="px-2 text-center">
                    <button
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      className="text-chalk/40 hover:text-red-300"
                      aria-label="Remove row"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-chalk/50">
                  No stats for this gameweek yet. Add the players who played.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-chalk/40 text-xs mt-2">
        Played: tick everyone who got on the pitch. GC: goals conceded (GK and DEF lose a point per 2). CS: clean sheet.
      </p>

      <div className="mt-4 flex items-center gap-4">
        <button onClick={save} disabled={saving || !gwId} className="bg-gold text-ink font-display px-6 py-3 disabled:opacity-50">
          {saving ? 'SAVING...' : 'SAVE STATS'}
        </button>
        {msg && <p className={`text-sm ${msg.ok ? 'text-turf' : 'text-red-400'}`}>{msg.text}</p>}
      </div>
    </div>
  )
}

function Gameweeks({ gameweeks }) {
  const router = useRouter()
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

  async function toggleLock(g) {
    setBusy(g.id)
    setMsg(null)
    try {
      await call('/api/admin/gameweeks', 'PATCH', { id: g.id, is_locked: !g.is_locked })
      router.refresh()
    } catch (e) {
      setMsg(e.message)
    }
    setBusy(null)
  }

  async function score(g) {
    setBusy(g.id)
    setMsg(null)
    try {
      const res = await call('/api/admin/score', 'POST', { gameweekId: g.id })
      setMsg(`${g.label}: scored ${res.squads} squads.`)
      router.refresh()
    } catch (e) {
      setMsg(e.message)
    }
    setBusy(null)
  }

  const openGw = gameweeks.find((g) => !g.is_locked)

  return (
    <div>
      <p className="text-chalk/60 text-sm mb-4">
        Both leagues use the same gameweek schedule. Managers pick squads for the earliest unlocked gameweek
        {openGw ? ` (currently ${openGw.label})` : ''}. Lock it before kickoff, enter stats for both leagues after
        their matches, then press Score to score both leagues.
      </p>
      <div className="border border-white/10 divide-y divide-white/5">
        {gameweeks.map((g) => (
          <div key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="font-display text-chalk w-32">{g.label.toUpperCase()}</span>
            <span className="text-chalk/50 w-28">{g.match_date}</span>
            <span className={`text-xs px-2 py-0.5 ${g.is_locked ? 'bg-red-900/60 text-chalk' : 'bg-turf/40 text-chalk'}`}>
              {g.is_locked ? 'Locked' : 'Open'}
            </span>
            {g.is_scored && <span className="text-xs px-2 py-0.5 bg-gold/80 text-ink">Scored</span>}
            <span className="flex-1" />
            <button
              onClick={() => toggleLock(g)}
              disabled={busy === g.id}
              className="border border-white/20 text-chalk/80 px-3 py-1 hover:text-gold"
            >
              {g.is_locked ? 'Unlock' : 'Lock'}
            </button>
            <button
              onClick={() => score(g)}
              disabled={busy === g.id}
              className="bg-gold text-ink font-display px-3 py-1"
            >
              {g.is_scored ? 'RE-SCORE' : 'SCORE'}
            </button>
          </div>
        ))}
      </div>
      {msg && <p className="text-sm text-chalk/80 mt-3">{msg}</p>}
    </div>
  )
}
