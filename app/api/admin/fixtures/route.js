import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/manager'

const LEAGUES = ['MSFL', 'WSFL']

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function fixtureFields(body) {
  const league = typeof body?.league === 'string' ? body.league : ''
  const home = typeof body?.home === 'string' ? body.home.trim() : ''
  const away = typeof body?.away === 'string' ? body.away.trim() : ''
  const gameweekNo = Number(body?.gameweek_no)

  if (!LEAGUES.includes(league)) return { error: 'Choose MSFL or WSFL' }
  if (!Number.isSafeInteger(gameweekNo) || gameweekNo < 1) return { error: 'Enter a valid gameweek number' }
  if (!isValidDate(body?.match_date)) return { error: 'Enter a valid match date' }
  if (!home || home.length > 120 || !away || away.length > 120) {
    return { error: 'Enter home and away teams (up to 120 characters each)' }
  }
  if (home === away) return { error: 'Home and away teams must be different' }

  let kickoff = null
  if (body.kickoff) {
    if (typeof body.kickoff !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(body.kickoff)) {
      return { error: 'Enter a valid kickoff time' }
    }
    kickoff = body.kickoff.length === 5 ? `${body.kickoff}:00` : body.kickoff
  }

  return {
    values: {
      league,
      gameweek_no: gameweekNo,
      match_date: body.match_date,
      kickoff,
      home,
      away,
    },
  }
}

function toScore(value) {
  if (value === '' || value === null || value === undefined) return null
  const score = Number(value)
  return Number.isSafeInteger(score) && score >= 0 ? score : null
}

async function checkGameweek(admin, number) {
  const { data, error } = await admin
    .from('gameweeks')
    .select('id')
    .ilike('label', `Gameweek ${number}`)
    .limit(1)
    .maybeSingle()
  if (error) return { status: 500, error: error.message }
  if (!data) return { status: 400, error: `Gameweek ${number} does not exist` }
  return null
}

export async function POST(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const { values, error: validationError } = fixtureFields(body || {})
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const admin = createAdminClient()
  const missingGameweek = await checkGameweek(admin, values.gameweek_no)
  if (missingGameweek) return NextResponse.json({ error: missingGameweek.error }, { status: missingGameweek.status })

  const { data, error } = await admin.from('fixtures').insert(values).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}

export async function PATCH(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const id = Number(body?.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: 'A valid fixture is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: current, error: readError } = await admin
    .from('fixtures')
    .select('id, league, gameweek_no, home, away, home_goals, away_goals')
    .eq('id', id)
    .maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!current) return NextResponse.json({ error: 'Fixture not found' }, { status: 404 })

  const updates = {}
  const scheduleFields = ['league', 'gameweek_no', 'match_date', 'kickoff', 'home', 'away']
  if (scheduleFields.some((field) => Object.prototype.hasOwnProperty.call(body || {}, field))) {
    const { values, error: validationError } = fixtureFields(body || {})
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
    Object.assign(updates, values)
    const missingGameweek = await checkGameweek(admin, values.gameweek_no)
    if (missingGameweek) return NextResponse.json({ error: missingGameweek.error }, { status: missingGameweek.status })

    const changesHistoricalFixture = ['league', 'gameweek_no', 'home', 'away'].some(
      (field) => values[field] !== current[field],
    )
    if (changesHistoricalFixture && (current.home_goals !== null || current.away_goals !== null)) {
      return NextResponse.json({
        error: 'Clear the fixture result before changing its league, gameweek, or teams.',
      }, { status: 409 })
    }
  }

  const hasHomeScore = Object.prototype.hasOwnProperty.call(body || {}, 'home_goals')
  const hasAwayScore = Object.prototype.hasOwnProperty.call(body || {}, 'away_goals')
  if (hasHomeScore || hasAwayScore) {
    if (!hasHomeScore || !hasAwayScore) {
      return NextResponse.json({ error: 'Enter both scores, or clear both' }, { status: 400 })
    }
    const homeGoals = toScore(body.home_goals)
    const awayGoals = toScore(body.away_goals)
    if ((body.home_goals !== '' && homeGoals === null) || (body.away_goals !== '' && awayGoals === null)) {
      return NextResponse.json({ error: 'Scores must be whole numbers greater than or equal to zero' }, { status: 400 })
    }
    if ((homeGoals === null) !== (awayGoals === null)) {
      return NextResponse.json({ error: 'Enter both scores, or clear both' }, { status: 400 })
    }
    updates.home_goals = homeGoals
    updates.away_goals = awayGoals
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No fixture changes were provided' }, { status: 400 })
  }

  const { data: updated, error } = await admin
    .from('fixtures')
    .update(updates)
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Fixture not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: 'A valid fixture is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: fixture, error: readError } = await admin
    .from('fixtures')
    .select('id, home_goals, away_goals')
    .eq('id', id)
    .maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!fixture) return NextResponse.json({ error: 'Fixture not found' }, { status: 404 })
  if (fixture.home_goals !== null || fixture.away_goals !== null) {
    return NextResponse.json({ error: 'Clear the fixture result before deleting it' }, { status: 409 })
  }

  const { error } = await admin.from('fixtures').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
