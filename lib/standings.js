// Builds a league table from fixtures with results.
// Order: points, goal difference, fewest goals conceded, then club name.
export function computeStandings(fixtures, teams, league) {
  const rows = {}
  teams
    .filter((t) => t.league === league)
    .forEach((t) => {
      rows[t.key] = { key: t.key, club: t.club, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [] }
    })

  fixtures
    .filter((f) => f.league === league && f.home_goals !== null && f.away_goals !== null)
    .sort((a, b) => (a.match_date || '').localeCompare(b.match_date || ''))
    .forEach((f) => {
      const h = rows[f.home]
      const a = rows[f.away]
      if (!h || !a) return
      h.p++
      a.p++
      h.gf += f.home_goals
      h.ga += f.away_goals
      a.gf += f.away_goals
      a.ga += f.home_goals
      if (f.home_goals > f.away_goals) {
        h.w++
        a.l++
        h.pts += 3
        h.form.push('W')
        a.form.push('L')
      } else if (f.home_goals < f.away_goals) {
        a.w++
        h.l++
        a.pts += 3
        h.form.push('L')
        a.form.push('W')
      } else {
        h.d++
        a.d++
        h.pts += 1
        a.pts += 1
        h.form.push('D')
        a.form.push('D')
      }
    })

  return Object.values(rows)
    .map((r) => ({ ...r, gd: r.gf - r.ga }))
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || x.ga - y.ga || x.club.localeCompare(y.club))
}
