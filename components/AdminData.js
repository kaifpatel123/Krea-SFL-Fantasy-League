'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

const LEAGUES = ['MSFL', 'WSFL']
const POSITIONS = ['GK', 'DEF', 'MID', 'FWD']
const SECTIONS = ['Weeks', 'Fixtures', 'Players', 'Teams']
const inputClass = 'w-full bg-ink border border-white/15 px-3 py-2 text-sm text-chalk'
const buttonClass = 'bg-gold text-ink font-display px-4 py-2 disabled:opacity-50'
const secondaryButtonClass = 'border border-white/20 text-chalk/80 px-3 py-2 text-sm hover:text-gold'

async function request(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Request failed')
  return result
}

function gameweekNumber(label) {
  const match = /^Gameweek\s+(\d+)$/i.exec(label || '')
  return match ? Number(match[1]) : null
}

function Message({ value }) {
  if (!value) return null
  return <p role="status" className={`mt-3 text-sm ${value.ok ? 'text-turf' : 'text-red-400'}`}>{value.text}</p>
}

function Field({ label, children }) {
  return (
    <label className="block text-xs text-chalk/60">
      <span className="block mb-1">{label}</span>
      {children}
    </label>
  )
}

export default function AdminData({ gameweeks, fixtures, players, teams }) {
  const [section, setSection] = useState('Weeks')
  const router = useRouter()

  return (
    <div>
      <p className="text-chalk/60 text-sm mb-5">
        Manage the schedule and roster here. Fantasy team points are still calculated from saved player stats.
      </p>
      <div className="flex flex-wrap gap-2 mb-6">
        {SECTIONS.map((item) => (
          <button
            key={item}
            onClick={() => setSection(item)}
            className={`px-3 py-1.5 text-xs font-display tracking-wider border ${
              section === item ? 'bg-chalk text-ink border-chalk' : 'border-white/15 text-chalk/70'
            }`}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>
      {section === 'Weeks' && <WeeksManager gameweeks={gameweeks} />}
      {section === 'Fixtures' && <FixturesManager fixtures={fixtures} gameweeks={gameweeks} router={router} />}
      {section === 'Players' && <PlayersManager players={players} teams={teams} router={router} />}
      {section === 'Teams' && <TeamsManager teams={teams} router={router} />}
    </div>
  )
}

function WeeksManager({ gameweeks }) {
  const nextNumber = Math.max(0, ...gameweeks.map((week) => gameweekNumber(week.label) || 0)) + 1
  const [number, setNumber] = useState(String(nextNumber))
  const [matchDate, setMatchDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  async function addWeek(event) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await request('/api/admin/gameweeks', 'POST', { number, match_date: matchDate })
      setMatchDate('')
      setNumber(String(Math.max(nextNumber, Number(number) + 1)))
      setMessage({ ok: true, text: `Gameweek ${number} created locked. Add its fixtures, then unlock it when ready.` })
      router.refresh()
    } catch (error) {
      setMessage({ ok: false, text: error.message })
    }
    setBusy(false)
  }

  async function deleteWeek(week) {
    if (!window.confirm(`Delete ${week.label}? This only works if it has no fixtures, squads, stats, or scores.`)) return
    setMessage(null)
    try {
      await request(`/api/admin/gameweeks?id=${week.id}`, 'DELETE')
      setMessage({ ok: true, text: `${week.label} deleted.` })
      router.refresh()
    } catch (error) {
      setMessage({ ok: false, text: error.message })
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addWeek} className="border border-white/10 p-4">
        <h2 className="font-display text-gold tracking-wider mb-3">ADD GAMEWEEK</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <Field label="Gameweek number">
            <input className={inputClass} type="number" min="1" step="1" required value={number} onChange={(e) => setNumber(e.target.value)} />
          </Field>
          <Field label="Gameweek date">
            <input className={inputClass} type="date" required value={matchDate} onChange={(e) => setMatchDate(e.target.value)} />
          </Field>
          <button className={buttonClass} disabled={busy}>{busy ? 'ADDING...' : 'ADD GAMEWEEK'}</button>
        </div>
        <p className="text-chalk/40 text-xs mt-2">New gameweeks start locked. Numbers stay fixed because fixtures link to them; update dates here.</p>
      </form>

      <div className="border border-white/10 divide-y divide-white/5">
        {gameweeks.map((week) => (
          <WeekRow key={week.id} week={week} onDelete={deleteWeek} />
        ))}
        {!gameweeks.length && <p className="p-4 text-chalk/50 text-sm">No gameweeks yet.</p>}
      </div>
      <Message value={message} />
    </div>
  )
}

function WeekRow({ week, onDelete }) {
  const router = useRouter()
  const [matchDate, setMatchDate] = useState(week.match_date || '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await request('/api/admin/gameweeks', 'PATCH', { id: week.id, match_date: matchDate })
      setMessage({ ok: true, text: 'Date saved.' })
      router.refresh()
    } catch (error) {
      setMessage({ ok: false, text: error.message })
    }
    setBusy(false)
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-3 p-4">
      <div className="font-display text-chalk w-32">{week.label}</div>
      <Field label="Date">
        <input className={inputClass} type="date" required value={matchDate} onChange={(e) => setMatchDate(e.target.value)} />
      </Field>
      <button className={secondaryButtonClass} disabled={busy || matchDate === week.match_date}>{busy ? 'SAVING...' : 'SAVE DATE'}</button>
      <button type="button" className={`${secondaryButtonClass} text-red-300`} onClick={() => onDelete(week)}>DELETE</button>
      {message && <span className={`text-xs ${message.ok ? 'text-turf' : 'text-red-400'}`}>{message.text}</span>}
    </form>
  )
}

const blankFixture = (gameweeks, league = 'MSFL') => ({
  league,
  gameweek_no: String(gameweekNumber(gameweeks[0]?.label) || 1),
  match_date: '',
  kickoff: '',
  home: '',
  away: '',
})

function FixturesManager({ fixtures, gameweeks, router }) {
  const [league, setLeague] = useState('MSFL')
  const [draft, setDraft] = useState(() => blankFixture(gameweeks))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const weeks = gameweeks.map((week) => gameweekNumber(week.label)).filter(Boolean)

  async function addFixture(event) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await request('/api/admin/fixtures', 'POST', { ...draft, gameweek_no: Number(draft.gameweek_no) })
      setDraft(blankFixture(gameweeks, league))
      setMessage({ ok: true, text: 'Fixture added.' })
      router.refresh()
    } catch (error) {
      setMessage({ ok: false, text: error.message })
    }
    setBusy(false)
  }

  async function deleteFixture(fixture) {
    if (!window.confirm(`Delete ${fixture.home} vs ${fixture.away}?`)) return
    setMessage(null)
    try {
      await request(`/api/admin/fixtures?id=${fixture.id}`, 'DELETE')
      setMessage({ ok: true, text: 'Fixture deleted.' })
      router.refresh()
    } catch (error) {
      setMessage({ ok: false, text: error.message })
    }
  }

  const list = fixtures.filter((fixture) => fixture.league === league)

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {LEAGUES.map((item) => (
          <button key={item} onClick={() => { setLeague(item); setDraft((current) => ({ ...current, league: item })) }}
            className={`px-3 py-1.5 text-xs font-display tracking-wider border ${league === item ? 'bg-gold text-ink border-gold' : 'border-white/15 text-chalk/70'}`}>
            {item}
          </button>
        ))}
      </div>

      <form onSubmit={addFixture} className="border border-white/10 p-4">
        <h2 className="font-display text-gold tracking-wider mb-3">ADD FIXTURE</h2>
        <FixtureFields values={draft} onChange={setDraft} weeks={weeks} />
        <button className={`${buttonClass} mt-4`} disabled={busy}>{busy ? 'ADDING...' : 'ADD FIXTURE'}</button>
      </form>

      <div className="space-y-3">
        {list.map((fixture) => (
          <FixtureRow key={fixture.id} fixture={fixture} weeks={weeks} onDelete={deleteFixture} />
        ))}
        {!list.length && <p className="text-chalk/50 text-sm">No fixtures for {league} yet.</p>}
      </div>
      <Message value={message} />
    </div>
  )
}

function FixtureFields({ values, onChange, weeks }) {
  function update(field, value) {
    onChange((current) => ({ ...current, [field]: value }))
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="League">
        <select className={inputClass} value={values.league} onChange={(e) => update('league', e.target.value)}>
          {LEAGUES.map((league) => <option key={league}>{league}</option>)}
        </select>
      </Field>
      <Field label="Gameweek">
        <select className={inputClass} required value={values.gameweek_no} onChange={(e) => update('gameweek_no', e.target.value)}>
          {weeks.map((week) => <option key={week} value={week}>Gameweek {week}</option>)}
          {!weeks.includes(Number(values.gameweek_no)) && <option value={values.gameweek_no}>Gameweek {values.gameweek_no}</option>}
        </select>
      </Field>
      <Field label="Match date">
        <input className={inputClass} type="date" required value={values.match_date} onChange={(e) => update('match_date', e.target.value)} />
      </Field>
      <Field label="Kickoff (optional)">
        <input className={inputClass} type="time" value={values.kickoff} onChange={(e) => update('kickoff', e.target.value)} />
      </Field>
      <Field label="Home team">
        <input className={inputClass} required maxLength={120} value={values.home} onChange={(e) => update('home', e.target.value)} />
      </Field>
      <Field label="Away team">
        <input className={inputClass} required maxLength={120} value={values.away} onChange={(e) => update('away', e.target.value)} />
      </Field>
    </div>
  )
}

function FixtureRow({ fixture, weeks, onDelete }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({
    league: fixture.league,
    gameweek_no: String(fixture.gameweek_no),
    match_date: fixture.match_date?.slice(0, 10) || '',
    kickoff: fixture.kickoff?.slice(0, 5) || '',
    home: fixture.home,
    away: fixture.away,
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await request('/api/admin/fixtures', 'PATCH', {
        id: fixture.id,
        ...values,
        gameweek_no: Number(values.gameweek_no),
      })
      setMessage({ ok: true, text: 'Fixture saved.' })
      setEditing(false)
      router.refresh()
    } catch (error) {
      setMessage({ ok: false, text: error.message })
    }
    setBusy(false)
  }

  if (editing) {
    return (
      <form onSubmit={save} className="border border-white/10 p-4">
        <FixtureFields values={values} onChange={setValues} weeks={weeks} />
        <div className="flex gap-2 mt-4">
          <button className={buttonClass} disabled={busy}>{busy ? 'SAVING...' : 'SAVE FIXTURE'}</button>
          <button type="button" className={secondaryButtonClass} onClick={() => setEditing(false)}>CANCEL</button>
        </div>
        <Message value={message} />
      </form>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-white/10 p-4">
      <div className="text-sm">
        <div className="text-chalk">{fixture.home} vs {fixture.away}</div>
        <div className="text-chalk/45 text-xs">
          GW {fixture.gameweek_no} · {fixture.match_date}{fixture.kickoff ? ` · ${fixture.kickoff.slice(0, 5)}` : ''}
        </div>
      </div>
      <div className="flex gap-2">
        <button className={secondaryButtonClass} onClick={() => setEditing(true)}>EDIT</button>
        <button className={`${secondaryButtonClass} text-red-300`} onClick={() => onDelete(fixture)}>DELETE</button>
      </div>
      <Message value={message} />
    </div>
  )
}

const blankPlayer = () => ({
  name: '',
  position: 'GK',
  league: 'MSFL',
  auction_team: '',
  batch: '',
  auction_price: '',
  fantasy_price: '',
  source: '',
})

function PlayersManager({ players, teams, router }) {
  const [form, setForm] = useState(blankPlayer)
  const [editingId, setEditingId] = useState(null)
  const [league, setLeague] = useState('MSFL')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const filtered = useMemo(() => players.filter((player) =>
    player.league === league &&
    `${player.name} ${player.auction_team}`.toLowerCase().includes(search.toLowerCase())
  ), [players, league, search])

  function startEdit(player) {
    setEditingId(player.id)
    setForm({
      name: player.name || '',
      position: player.position || 'GK',
      league: player.league || 'MSFL',
      auction_team: player.auction_team || '',
      batch: player.batch || '',
      auction_price: player.auction_price ?? '',
      fantasy_price: player.fantasy_price ?? '',
      source: player.source || '',
    })
    setMessage(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(blankPlayer())
    setMessage(null)
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await request('/api/admin/players', editingId ? 'PATCH' : 'POST', { ...form, id: editingId })
      const text = editingId ? 'Player updated.' : 'Player added.'
      setEditingId(null)
      setForm(blankPlayer())
      setMessage({ ok: true, text })
      router.refresh()
    } catch (error) {
      setMessage({ ok: false, text: error.message })
    }
    setBusy(false)
  }

  async function deletePlayer(player) {
    if (!window.confirm(`Delete ${player.name}? Deletion is blocked if the player appears in saved squads or stats.`)) return
    setMessage(null)
    try {
      await request(`/api/admin/players?id=${player.id}`, 'DELETE')
      setMessage({ ok: true, text: 'Player deleted.' })
      router.refresh()
    } catch (error) {
      setMessage({ ok: false, text: error.message })
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="border border-white/10 p-4">
        <h2 className="font-display text-gold tracking-wider mb-3">{editingId ? 'EDIT PLAYER' : 'ADD PLAYER'}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Player name"><input className={inputClass} required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Position">
            <select className={inputClass} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}>
              {POSITIONS.map((position) => <option key={position}>{position}</option>)}
            </select>
          </Field>
          <Field label="League">
            <select className={inputClass} value={form.league} onChange={(e) => setForm({ ...form, league: e.target.value })}>
              {LEAGUES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Auction team">
            <input className={inputClass} list="auction-team-keys" required maxLength={120} value={form.auction_team} onChange={(e) => setForm({ ...form, auction_team: e.target.value })} />
            <datalist id="auction-team-keys">
              {teams.filter((team) => team.league === form.league).map((team) => <option key={team.key} value={team.key} />)}
            </datalist>
          </Field>
          <Field label="Auction price"><input className={inputClass} type="number" min="0" step="0.5" required value={form.auction_price} onChange={(e) => setForm({ ...form, auction_price: e.target.value })} /></Field>
          <Field label="Fantasy price"><input className={inputClass} type="number" min="0" step="0.5" required value={form.fantasy_price} onChange={(e) => setForm({ ...form, fantasy_price: e.target.value })} /></Field>
          <Field label="Batch (optional)"><input className={inputClass} maxLength={80} value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} /></Field>
          <Field label="Source (optional)"><input className={inputClass} maxLength={160} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
        </div>
        <div className="flex gap-2 mt-4">
          <button className={buttonClass} disabled={busy}>{busy ? 'SAVING...' : editingId ? 'SAVE PLAYER' : 'ADD PLAYER'}</button>
          {editingId && <button type="button" className={secondaryButtonClass} onClick={cancelEdit}>CANCEL</button>}
        </div>
        <Message value={message} />
      </form>

      <div className="flex flex-wrap items-center gap-3">
        {LEAGUES.map((item) => (
          <button key={item} onClick={() => setLeague(item)}
            className={`px-3 py-1.5 text-xs font-display tracking-wider border ${league === item ? 'bg-gold text-ink border-gold' : 'border-white/15 text-chalk/70'}`}>
            {item}
          </button>
        ))}
        <input className={`${inputClass} max-w-xs`} placeholder="Search players or auction teams" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="text-chalk/40 text-xs">{filtered.length} players</span>
      </div>

      <div className="overflow-x-auto border border-white/10">
        <table className="w-full text-sm">
          <thead><tr className="text-chalk/60 text-xs uppercase tracking-wider border-b border-white/10">
            <th className="p-3 text-left">Player</th><th className="p-3 text-left">Position</th><th className="p-3 text-left">Auction team</th>
            <th className="p-3 text-right">Auction price</th><th className="p-3 text-right">Fantasy price</th><th className="p-3" />
          </tr></thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((player) => (
              <tr key={player.id}>
                <td className="p-3 text-chalk">{player.name}</td>
                <td className="p-3 text-chalk/70">{player.position}</td>
                <td className="p-3 text-chalk/70">{player.auction_team}</td>
                <td className="p-3 text-right text-chalk/70">{player.auction_price}</td>
                <td className="p-3 text-right text-chalk/70">{player.fantasy_price}</td>
                <td className="p-3 whitespace-nowrap">
                  <button className={secondaryButtonClass} onClick={() => startEdit(player)}>EDIT</button>
                  <button className={`${secondaryButtonClass} ml-2 text-red-300`} onClick={() => deletePlayer(player)}>DELETE</button>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td className="p-4 text-center text-chalk/45" colSpan={6}>No matching players.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const blankTeam = () => ({ key: '', club: '', league: 'MSFL' })

function TeamsManager({ teams, router }) {
  const [form, setForm] = useState(blankTeam)
  const [originalKey, setOriginalKey] = useState(null)
  const [originalLeague, setOriginalLeague] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  function startEdit(team) {
    setOriginalKey(team.key)
    setOriginalLeague(team.league)
    setForm({ key: team.key, club: team.club, league: team.league })
    setMessage(null)
  }

  function cancelEdit() {
    setForm(blankTeam())
    setOriginalKey(null)
    setOriginalLeague(null)
    setMessage(null)
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await request('/api/admin/teams', originalKey ? 'PATCH' : 'POST', {
        ...form,
        originalKey,
        originalLeague,
      })
      const text = originalKey ? 'Team updated.' : 'Team added.'
      setForm(blankTeam())
      setOriginalKey(null)
      setOriginalLeague(null)
      setMessage({ ok: true, text })
      router.refresh()
    } catch (error) {
      setMessage({ ok: false, text: error.message })
    }
    setBusy(false)
  }

  async function deleteTeam(team) {
    if (!window.confirm(`Delete ${team.club}? Deletion is blocked while players or fixtures use this team key.`)) return
    setMessage(null)
    try {
      await request(`/api/admin/teams?key=${encodeURIComponent(team.key)}`, 'DELETE')
      setMessage({ ok: true, text: 'Team deleted.' })
      router.refresh()
    } catch (error) {
      setMessage({ ok: false, text: error.message })
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="border border-white/10 p-4">
        <h2 className="font-display text-gold tracking-wider mb-3">{originalKey ? 'EDIT TEAM' : 'ADD TEAM'}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Team key"><input className={inputClass} required maxLength={120} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} /></Field>
          <Field label="Display name"><input className={inputClass} required maxLength={120} value={form.club} onChange={(e) => setForm({ ...form, club: e.target.value })} /></Field>
          <Field label="League">
            <select className={inputClass} value={form.league} onChange={(e) => setForm({ ...form, league: e.target.value })}>
              {LEAGUES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
        </div>
        {originalKey && <p className="text-chalk/40 text-xs mt-2">A team key or league can only change when no players or fixtures refer to it.</p>}
        <div className="flex gap-2 mt-4">
          <button className={buttonClass} disabled={busy}>{busy ? 'SAVING...' : originalKey ? 'SAVE TEAM' : 'ADD TEAM'}</button>
          {originalKey && <button type="button" className={secondaryButtonClass} onClick={cancelEdit}>CANCEL</button>}
        </div>
        <Message value={message} />
      </form>

      <div className="overflow-x-auto border border-white/10">
        <table className="w-full text-sm">
          <thead><tr className="text-chalk/60 text-xs uppercase tracking-wider border-b border-white/10">
            <th className="p-3 text-left">Team key</th><th className="p-3 text-left">Display name</th><th className="p-3 text-left">League</th><th className="p-3" />
          </tr></thead>
          <tbody className="divide-y divide-white/5">
            {teams.map((team) => (
              <tr key={team.key}>
                <td className="p-3 text-chalk">{team.key}</td><td className="p-3 text-chalk/70">{team.club}</td><td className="p-3 text-chalk/70">{team.league}</td>
                <td className="p-3 whitespace-nowrap">
                  <button className={secondaryButtonClass} onClick={() => startEdit(team)}>EDIT</button>
                  <button className={`${secondaryButtonClass} ml-2 text-red-300`} onClick={() => deleteTeam(team)}>DELETE</button>
                </td>
              </tr>
            ))}
            {!teams.length && <tr><td className="p-4 text-center text-chalk/45" colSpan={4}>No teams yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
