'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const QUOTA = { GK: 1, DEF: 3, MID: 3, FWD: 1 }
const POSITIONS = ['GK', 'DEF', 'MID', 'FWD']
const PITCH_ROWS = ['FWD', 'MID', 'DEF', 'GK']
const FREE_TRANSFERS = 1
const TRANSFER_HIT = 4
const OUTFIELD_STARTERS = 5 // + the goalkeeper = 6 starters; 2 outfield subs

export default function SquadBuilder({
  players,
  gameweek,
  manager,
  existingSquad,
  existingPicks,
  savedForThisGw,
  budget,
  testMode,
  baselineIds,
}) {
  const router = useRouter()
  const [selected, setSelected] = useState(() => new Set(existingPicks.map((p) => p.player_id)))
  // Outfield subs (the goalkeeper always starts).
  const [bench, setBench] = useState(() => new Set(existingPicks.filter((p) => p.is_starting === false).map((p) => p.player_id)))
  const locked = savedForThisGw
  const [captainId, setCaptainId] = useState(existingSquad?.captain_id || null)
  const [viceId, setViceId] = useState(existingSquad?.vice_captain_id || null)
  const [filterPos, setFilterPos] = useState('ALL')
  const [filterClub, setFilterClub] = useState('ALL')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('price')
  const [cardId, setCardId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const playerMap = useMemo(() => {
    const m = {}
    players.forEach((p) => (m[p.id] = p))
    return m
  }, [players])

  const clubs = useMemo(() => Array.from(new Set(players.map((p) => p.club).filter(Boolean))).sort(), [players])

  const selectedPlayers = [...selected].map((id) => playerMap[id]).filter(Boolean)
  const spent = selectedPlayers.reduce((s, p) => s + Number(p.fantasy_price), 0)
  const remaining = budget - spent
  const countByPos = POSITIONS.reduce((acc, pos) => {
    acc[pos] = selectedPlayers.filter((p) => p.position === pos).length
    return acc
  }, {})
  const squadFull = selectedPlayers.length === 8
  const isBench = (p) => p.position !== 'GK' && bench.has(p.id)
  const starters = selectedPlayers.filter((p) => !isBench(p))
  const subs = selectedPlayers.filter((p) => isBench(p))
  const lineupOk = squadFull && starters.length === OUTFIELD_STARTERS + 1 && subs.length === 2
  const transfers = baselineIds ? [...selected].filter((id) => !baselineIds.includes(id)).length : 0
  const hit = Math.max(0, transfers - FREE_TRANSFERS) * TRANSFER_HIT
  const ready =
    !locked && lineupOk && remaining >= -1e-9 && captainId && viceId && captainId !== viceId && !bench.has(captainId) && !bench.has(viceId)

  function toggle(p) {
    if (locked) return
    setMessage(null)
    const next = new Set(selected)
    if (next.has(p.id)) {
      next.delete(p.id)
      if (captainId === p.id) setCaptainId(null)
      if (viceId === p.id) setViceId(null)
      if (bench.has(p.id)) setBench((b) => new Set([...b].filter((id) => id !== p.id)))
    } else {
      if (countByPos[p.position] >= QUOTA[p.position]) {
        setMessage({ type: 'error', text: `You already have ${QUOTA[p.position]} ${p.position}. Remove one first.` })
        return
      }
      if (Number(p.fantasy_price) > remaining + 1e-9) {
        setMessage({ type: 'error', text: `${p.name} costs ${Number(p.fantasy_price).toFixed(1)} and you only have ${remaining.toFixed(1)} left.` })
        return
      }
      next.add(p.id)
      // New outfield picks start until 5 outfield starters, then go to the bench.
      const outfieldStarting = selectedPlayers.filter((x) => x.position !== 'GK' && !bench.has(x.id)).length
      if (p.position !== 'GK' && outfieldStarting >= OUTFIELD_STARTERS) setBench((b) => new Set([...b, p.id]))
    }
    setSelected(next)
  }

  function toggleBench(p) {
    if (locked || p.position === 'GK') return
    setMessage(null)
    if (bench.has(p.id)) {
      if (starters.length >= OUTFIELD_STARTERS + 1) {
        setMessage({ type: 'error', text: 'You already have 6 starters. Move a starter to the bench first.' })
        return
      }
      setBench((b) => new Set([...b].filter((id) => id !== p.id)))
    } else {
      if (subs.length >= 2) {
        setMessage({ type: 'error', text: 'You can only have 2 subs. Bring one back into the starting six first.' })
        return
      }
      if (captainId === p.id) setCaptainId(null)
      if (viceId === p.id) setViceId(null)
      setBench((b) => new Set([...b, p.id]))
    }
  }

  function makeCaptain(id) {
    if (locked || bench.has(id)) return
    if (viceId === id) setViceId(captainId)
    setCaptainId(id)
  }

  function makeVice(id) {
    if (locked || bench.has(id)) return
    if (captainId === id) setCaptainId(viceId)
    setViceId(id)
  }

  async function save() {
    const lockNote = `Once saved, your squad for ${gameweek.label} is locked and can't be changed until the next gameweek.`
    const hitNote = hit ? `\n\nThis also costs ${hit} points (${transfers} transfers, 1 free).` : ''
    if (!window.confirm(`${lockNote}${hitNote}\n\nSave this squad?`)) return
    setSaving(true)
    setMessage(null)
    const res = await fetch('/api/squad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerIds: [...selected],
        starterIds: starters.map((p) => p.id),
        captainId,
        viceCaptainId: viceId,
        gameweekId: gameweek.id,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setMessage({ type: 'error', text: json.error || 'Could not save your squad.' })
      return
    }
    setMessage({ type: 'ok', text: `Squad saved and locked for ${json.gameweek}.` })
    router.refresh()
  }

  async function switchManager() {
    await fetch('/api/manager', { method: 'DELETE' })
    router.refresh()
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/')
    router.refresh()
  }

  function blockReason(p) {
    if (locked) return `Your squad is locked for ${gameweek.label}`
    if (selected.has(p.id)) return null
    if (countByPos[p.position] >= QUOTA[p.position]) return `You already have ${QUOTA[p.position]} ${p.position}`
    if (Number(p.fantasy_price) > remaining + 1e-9) return `Not enough budget (${remaining.toFixed(1)} left)`
    return null
  }

  const market = players
    .filter((p) => filterPos === 'ALL' || p.position === filterPos)
    .filter((p) => filterClub === 'ALL' || p.club === filterClub)
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'points') return (b.stats?.points || 0) - (a.stats?.points || 0)
      if (sortBy === 'form') return (b.stats?.form || 0) - (a.stats?.form || 0)
      if (sortBy === 'goals') return (b.stats?.goals || 0) + (b.stats?.assists || 0) - (a.stats?.goals || 0) - (a.stats?.assists || 0)
      return Number(b.fantasy_price) - Number(a.fantasy_price)
    })

  return (
    <div className="pt-4">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="font-display text-gold text-sm tracking-[0.3em] mb-1">{gameweek.label.toUpperCase()}</p>
          <h1 className="font-display text-4xl text-chalk">{manager.name}</h1>
          <p className="text-chalk/50 text-sm mt-1">
            {locked
              ? 'Squad saved and locked for this gameweek. You can make transfers when the next gameweek opens.'
              : 'Pick 8, choose your starting 6, then save. Squads lock once saved.'}
            {testMode ? (
              <button onClick={switchManager} className="ml-3 underline hover:text-gold">
                Switch test manager
              </button>
            ) : (
              <button onClick={signOut} className="ml-3 underline hover:text-gold">
                Sign out
              </button>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          <Stat label="Players" value={`${selectedPlayers.length}/8`} />
          <Stat label="Spent" value={spent.toFixed(1)} />
          <Stat label="Left" value={remaining.toFixed(1)} warn={remaining < 0} />
          {baselineIds && <Stat label="Transfers" value={`${transfers} (1 free)`} />}
          {baselineIds && <Stat label="Hit" value={hit ? `-${hit}` : '0'} warn={hit > 0} />}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-8">
        {/* Pitch */}
        <div>
          <div className="relative border border-white/20 bg-pitchline/40 p-4 space-y-5">
            <div className="absolute inset-x-0 top-1/2 border-t border-white/10 pointer-events-none" />
            {PITCH_ROWS.map((pos) => {
              const startingHere = starters.filter((p) => p.position === pos)
              const missing = QUOTA[pos] - selectedPlayers.filter((p) => p.position === pos).length
              if (!startingHere.length && missing <= 0) return null
              return (
                <div key={pos} className="relative flex justify-center gap-2 sm:gap-3">
                  {startingHere.map((p) => (
                    <Slot
                      key={p.id}
                      p={p}
                      isC={captainId === p.id}
                      isV={viceId === p.id}
                      locked={locked}
                      onRemove={() => toggle(p)}
                      onC={() => makeCaptain(p.id)}
                      onV={() => makeVice(p.id)}
                      onBench={p.position === 'GK' ? null : () => toggleBench(p)}
                    />
                  ))}
                  {!locked &&
                    Array.from({ length: Math.max(0, missing) }).map((_, i) => (
                      <button
                        key={`e${i}`}
                        onClick={() => setFilterPos(pos)}
                        className="w-[84px] sm:w-24 h-[92px] border border-dashed border-white/25 text-chalk/40 text-xs flex flex-col items-center justify-center hover:border-gold hover:text-gold"
                      >
                        <span className="font-display text-lg">+</span>
                        {pos}
                      </button>
                    ))}
                </div>
              )
            })}
          </div>

          <div className="border border-t-0 border-white/20 bg-ink/60 p-3">
            <p className="text-xs text-chalk/50 mb-2">
              Subs ({subs.length}/2). They don&apos;t score. Tap <span className="text-chalk">Bench</span> on a starter to swap.
            </p>
            <div className="flex justify-center gap-2 sm:gap-3 min-h-[92px]">
              {subs.map((p) => (
                <Slot key={p.id} p={p} sub locked={locked} onRemove={() => toggle(p)} onBench={() => toggleBench(p)} />
              ))}
              {Array.from({ length: Math.max(0, 2 - subs.length) }).map((_, i) => (
                <div
                  key={`s${i}`}
                  className="w-[84px] sm:w-24 h-[92px] border border-dashed border-white/15 text-chalk/30 text-xs flex items-center justify-center"
                >
                  SUB
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={save}
              disabled={!ready || saving}
              className="bg-gold text-ink font-display text-lg px-6 py-3 tracking-wide disabled:opacity-40"
            >
              {locked ? 'SQUAD LOCKED' : saving ? 'SAVING...' : 'SAVE SQUAD'}
            </button>
            {!ready && (
              <p className="text-chalk/50 text-sm">
                {locked
                  ? `Locked for ${gameweek.label}.`
                  : !squadFull
                  ? 'Pick 1 GK, 3 DEF, 3 MID and 1 FWD.'
                  : remaining < 0
                  ? 'You are over budget.'
                  : !lineupOk
                  ? 'Choose your starting 6: the goalkeeper plus 5 others. The other 2 are subs.'
                  : 'Tap C and V on two starters to choose a captain and vice-captain.'}
              </p>
            )}
          </div>
          {message && (
            <p className={`mt-3 text-sm ${message.type === 'error' ? 'text-red-400' : 'text-turf'}`}>{message.text}</p>
          )}
        </div>

        {/* Market */}
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            {['ALL', ...POSITIONS].map((pos) => (
              <button
                key={pos}
                onClick={() => setFilterPos(pos)}
                className={`px-3 py-1.5 text-xs font-display tracking-wider border ${
                  filterPos === pos ? 'bg-gold text-ink border-gold' : 'border-white/15 text-chalk/70 hover:text-gold'
                }`}
              >
                {pos}
                {pos !== 'ALL' && (
                  <span className="ml-1 opacity-70">
                    {countByPos[pos]}/{QUOTA[pos]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players"
              className="flex-1 min-w-[10rem] bg-ink border border-white/15 px-3 py-2 text-sm text-chalk placeholder:text-chalk/30 outline-none focus:border-gold"
            />
            <select
              value={filterClub}
              onChange={(e) => setFilterClub(e.target.value)}
              className="bg-ink border border-white/15 px-2 py-2 text-sm text-chalk outline-none focus:border-gold"
            >
              <option value="ALL">All clubs</option>
              {clubs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort players"
              className="bg-ink border border-white/15 px-2 py-2 text-sm text-chalk outline-none focus:border-gold"
            >
              <option value="price">Price</option>
              <option value="points">Total pts</option>
              <option value="form">Form</option>
              <option value="goals">G + A</option>
            </select>
          </div>

          <div className="border border-white/10 max-h-[560px] overflow-y-auto divide-y divide-white/5">
            <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-chalk/40 border-b border-white/10">
              <span className="w-9" />
              <span className="flex-1">Player</span>
              <span className="w-12 text-right">Price</span>
              <span className="w-10 text-right">Pts</span>
              <span className="w-8" />
            </div>
            {market.map((p) => {
              const isSel = selected.has(p.id)
              const blocked = !!blockReason(p)
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${isSel ? 'bg-turf/25' : 'hover:bg-white/5'}`}
                >
                  <button onClick={() => setCardId(p.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                    <span className="w-9 shrink-0 text-[10px] font-bold text-center py-0.5 bg-ink text-chalk/80">{p.position}</span>
                    <span className="flex-1 min-w-0">
                      <span className={`block truncate ${blocked ? 'text-chalk/40' : 'text-chalk'}`}>{p.name}</span>
                      <span className="block text-chalk/45 text-xs truncate">
                        {p.club}
                        {p.next ? ` · vs ${p.next}` : ''}
                      </span>
                    </span>
                    <span className="w-12 text-right font-display text-gold scoreboard-num">{Number(p.fantasy_price).toFixed(1)}</span>
                    <span className="w-10 text-right font-display text-chalk scoreboard-num">{p.stats?.points ?? 0}</span>
                  </button>
                  <button
                    onClick={() => toggle(p)}
                    disabled={blocked}
                    aria-label={isSel ? `Remove ${p.name}` : `Add ${p.name}`}
                    className={`w-8 h-8 shrink-0 border font-display text-lg leading-none disabled:opacity-25 ${
                      isSel ? 'border-red-300/50 text-red-300 hover:bg-red-300/10' : 'border-turf/60 text-turf hover:bg-turf/20'
                    }`}
                  >
                    {isSel ? '−' : '+'}
                  </button>
                </div>
              )
            })}
            {market.length === 0 && <p className="px-3 py-6 text-chalk/50 text-sm">No players match.</p>}
          </div>
        </div>
      </div>
      {cardId && playerMap[cardId] && (
        <PlayerCard
          p={playerMap[cardId]}
          isSel={selected.has(cardId)}
          isC={captainId === cardId}
          isV={viceId === cardId}
          isBenched={bench.has(cardId)}
          blocked={blockReason(playerMap[cardId])}
          onToggle={() => toggle(playerMap[cardId])}
          onCaptain={() => makeCaptain(cardId)}
          onVice={() => makeVice(cardId)}
          onClose={() => setCardId(null)}
        />
      )}
    </div>
  )
}

const POS_NAME = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' }

function PlayerCard({ p, isSel, isC, isV, isBenched, blocked, onToggle, onCaptain, onVice, onClose }) {
  const st = p.stats
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tiles = [
    ['Total pts', st?.points ?? 0],
    ['Pts / match', st?.perMatch ?? 0],
    ['Form', st?.form ?? 0],
    ['Apps', st?.apps ?? 0],
    ['Goals', st?.goals ?? 0],
    ['Assists', st?.assists ?? 0],
    [p.position === 'FWD' ? 'MOTM' : 'Clean sheets', p.position === 'FWD' ? st?.motm ?? 0 : st?.cleanSheets ?? 0],
    ['Cards', st ? `${st.yellows}Y ${st.reds}R` : '0'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={p.name}>
      <button className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close" />
      <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-ink border border-white/15 shadow-2xl">
        <div className="bg-pitchline/60 px-5 pt-5 pb-4 border-b border-white/10">
          <button onClick={onClose} className="absolute top-3 right-4 text-chalk/50 hover:text-gold text-xl" aria-label="Close">
            {'×'}
          </button>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">{POS_NAME[p.position] || p.position}</p>
          <h2 className="font-display text-3xl text-chalk leading-tight mt-1 pr-8">{p.name}</h2>
          <p className="text-chalk/60 text-sm mt-1">{p.club}</p>
          <div className="flex items-end justify-between mt-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-chalk/50">Price</p>
              <p className="font-display text-2xl text-gold scoreboard-num">{Number(p.fantasy_price).toFixed(1)}</p>
            </div>
            {p.next && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-chalk/50">Next match</p>
                <p className="text-chalk text-sm">vs {p.next}</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 border-b border-white/10">
          {tiles.map(([label, value], i) => (
            <div key={label} className={`px-3 py-3 text-center ${i % 4 ? 'border-l border-white/10' : ''} ${i >= 4 ? 'border-t border-white/10' : ''}`}>
              <p className="font-display text-xl text-chalk scoreboard-num">{value}</p>
              <p className="text-[10px] uppercase tracking-wider text-chalk/45 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="px-5 py-4">
          <p className="font-display text-sm tracking-wider text-chalk/70 mb-2">THIS SEASON</p>
          {!st ? (
            <p className="text-chalk/50 text-sm">No scored matches yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-chalk/45 uppercase tracking-wider border-b border-white/10">
                    <th className="text-left py-1.5 pr-2 font-normal">GW</th>
                    <th className="text-left py-1.5 pr-2 font-normal">Opponent</th>
                    <th className="text-left py-1.5 pr-2 font-normal">Result</th>
                    <th className="py-1.5 px-1 font-normal">G</th>
                    <th className="py-1.5 px-1 font-normal">A</th>
                    <th className="py-1.5 px-1 font-normal">CS</th>
                    <th className="py-1.5 px-1 font-normal">Cards</th>
                    <th className="text-right py-1.5 pl-2 font-normal">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {st.history.map((h) => (
                    <tr key={h.gw} className="border-b border-white/5">
                      <td className="py-1.5 pr-2 text-chalk/70">{h.gw}</td>
                      <td className="py-1.5 pr-2 text-chalk">{h.opp || '-'}</td>
                      <td className="py-1.5 pr-2 text-chalk/70 whitespace-nowrap">{h.result || '-'}</td>
                      {h.played ? (
                        <>
                          <td className="py-1.5 px-1 text-center scoreboard-num">{h.goals}</td>
                          <td className="py-1.5 px-1 text-center scoreboard-num">{h.assists}</td>
                          <td className="py-1.5 px-1 text-center">{h.cleanSheet ? '✓' : '-'}</td>
                          <td className="py-1.5 px-1 text-center whitespace-nowrap">
                            {h.yellows ? <span className="inline-block w-2 h-3 bg-yellow-400 mr-0.5 align-middle" /> : null}
                            {h.reds ? <span className="inline-block w-2 h-3 bg-red-500 align-middle" /> : null}
                            {!h.yellows && !h.reds ? '-' : null}
                          </td>
                        </>
                      ) : (
                        <td colSpan={4} className="py-1.5 px-1 text-center text-chalk/40">Did not play</td>
                      )}
                      <td className="py-1.5 pl-2 text-right font-display text-sm text-gold scoreboard-num">
                        {h.points}
                        {h.motm && <span className="ml-1 text-[9px] text-chalk/60 align-top">MOTM</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex flex-wrap gap-2">
          <button
            onClick={() => {
              onToggle()
              onClose()
            }}
            disabled={!!blocked}
            className={`flex-1 min-w-[140px] font-display text-lg px-4 py-3 tracking-wide disabled:opacity-40 ${
              isSel ? 'border border-red-300/60 text-red-300 hover:bg-red-300/10' : 'bg-gold text-ink hover:bg-gold/90'
            }`}
          >
            {isSel ? 'REMOVE' : 'ADD TO SQUAD'}
          </button>
          {isSel && !locked && !(p.position !== 'GK' && isBenched) && (
            <>
              <button
                onClick={onCaptain}
                className={`px-4 py-3 font-display tracking-wide border ${isC ? 'bg-gold text-ink border-gold' : 'border-white/20 text-chalk hover:text-gold'}`}
              >
                {isC ? 'CAPTAIN' : 'MAKE C'}
              </button>
              <button
                onClick={onVice}
                className={`px-4 py-3 font-display tracking-wide border ${isV ? 'bg-chalk text-ink border-chalk' : 'border-white/20 text-chalk hover:text-gold'}`}
              >
                {isV ? 'VICE' : 'MAKE VC'}
              </button>
            </>
          )}
          {blocked && <p className="w-full text-chalk/50 text-xs">{blocked}</p>}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, warn }) {
  return (
    <div className="text-right">
      <p className="text-chalk/50 text-xs uppercase tracking-wider">{label}</p>
      <p className={`font-display text-2xl scoreboard-num ${warn ? 'text-red-400' : 'text-chalk'}`}>{value}</p>
    </div>
  )
}

function Slot({ p, isC, isV, sub, locked, onRemove, onC, onV, onBench }) {
  const short = p.name.split(' ')[0]
  return (
    <div className={`w-[84px] sm:w-24 border text-center relative ${sub ? 'bg-ink/60 border-white/10 opacity-80' : 'bg-ink/90 border-white/15'}`}>
      {!locked && (
        <button onClick={onRemove} className="absolute top-0.5 right-1 text-chalk/40 hover:text-red-300 text-xs" aria-label={`Remove ${p.name}`}>
          ×
        </button>
      )}
      <p className="text-chalk text-xs font-medium pt-3 px-1 truncate" title={p.name}>
        {short}
      </p>
      <p className="text-chalk/40 text-[10px] truncate px-1">{p.position} · {p.club}</p>
      <p className="font-display text-gold text-sm scoreboard-num">{Number(p.fantasy_price).toFixed(1)}</p>
      {locked ? (
        <div className="border-t border-white/10 text-[11px] font-bold py-1 text-chalk/60">
          {sub ? 'SUB' : isC ? <span className="text-gold">CAPTAIN</span> : isV ? 'VICE' : ' '}
        </div>
      ) : sub ? (
        <button onClick={onBench} className="w-full border-t border-white/10 text-[11px] font-bold py-1 text-turf hover:text-chalk">
          START
        </button>
      ) : (
        <div className="flex border-t border-white/10">
          <button
            onClick={onC}
            className={`flex-1 text-[11px] font-bold py-1 ${isC ? 'bg-gold text-ink' : 'text-chalk/50 hover:text-gold'}`}
          >
            C
          </button>
          <button
            onClick={onV}
            className={`flex-1 text-[11px] font-bold py-1 border-l border-white/10 ${
              isV ? 'bg-chalk text-ink' : 'text-chalk/50 hover:text-chalk'
            }`}
          >
            V
          </button>
          {onBench && (
            <button
              onClick={onBench}
              className="flex-1 text-[10px] font-bold py-1 border-l border-white/10 text-chalk/50 hover:text-turf"
              title="Move to bench"
              aria-label={`Move ${p.name} to the bench`}
            >
              BENCH
            </button>
          )}
        </div>
      )}
    </div>
  )
}
