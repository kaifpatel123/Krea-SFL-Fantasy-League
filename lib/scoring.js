export function pointsForPlayerStat(stat, position) {
  if (!stat) return 0
  let pts = 0

  if (stat.minutes_played > 0) pts += 1

  const goalPoints = { GK: 6, DEF: 6, MID: 5, FWD: 4 }
  pts += (stat.goals || 0) * (goalPoints[position] || 4)

  pts += (stat.assists || 0) * 3

  if (stat.clean_sheet) {
    if (position === 'GK' || position === 'DEF') pts += 4
    else if (position === 'MID') pts += 1
  }

  if (position === 'GK' || position === 'DEF') {
    pts -= Math.floor((stat.goals_conceded || 0) / 2)
  }

  pts -= (stat.yellow_cards || 0) * 1
  pts -= (stat.red_cards || 0) * 3
  pts -= (stat.own_goals || 0) * 2

  if (stat.motm) pts += 3

  return pts
}

export function computeSquadPoints({ squadPlayers, players, stats, captainId, viceCaptainId }) {
  const breakdown = []
  let total = 0

  const starters = squadPlayers.filter((sp) => sp.is_starting)

  const captainPlayed = stats[captainId] && stats[captainId].minutes_played > 0
  const multiplierPlayerId = captainPlayed ? captainId : viceCaptainId

  for (const sp of starters) {
    const player = players[sp.player_id]
    const stat = stats[sp.player_id]
    let pts = pointsForPlayerStat(stat, player?.position)
    const isMultiplied = sp.player_id === multiplierPlayerId
    if (isMultiplied) pts *= 2
    total += pts
    breakdown.push({
      player_id: sp.player_id,
      name: player?.name,
      points: pts,
      captain: isMultiplied,
    })
  }

  return { total, breakdown }
}
