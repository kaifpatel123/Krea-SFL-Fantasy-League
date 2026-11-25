import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-server";
import { getManager } from "@/lib/manager";
import { TEST_MODE, BUDGET } from "@/lib/config";
import SquadBuilder from "@/components/SquadBuilder";
import { pointsForPlayerStat } from "@/lib/scoring";
import ManagerSetup from "@/components/ManagerSetup";
import EntryPayment from "@/components/EntryPayment";
import {
  getEntryFeePaise,
  getLatestEntryPayment,
  hasPaidEntry,
  PAYMENT_REQUIRED,
} from "@/lib/payments";
import LeagueTabs from "@/components/LeagueTabs";

export const dynamic = "force-dynamic";

export default async function SquadPage({ searchParams }) {
  const league = searchParams?.league === "WSFL" ? "WSFL" : "MSFL";
  const manager = await getManager();

  if (!manager) {
    if (!TEST_MODE) redirect("/login");
    return <ManagerSetup />;
  }

  // First sign-in with Google: pick a team name before anything else.
  if (!manager.display_name) return <ManagerSetup signedIn />;

  if (PAYMENT_REQUIRED && !(await hasPaidEntry(manager.id))) {
    const [amountPaise, payment] = await Promise.all([
      getEntryFeePaise(),
      getLatestEntryPayment(manager.id),
    ]);
    return (
      <div>
        <EntryPayment
          amountPaise={amountPaise}
          payment={payment}
          formUrl={process.env.NEXT_PUBLIC_GOOGLE_FORM_URL || ""}
          qrUrl="/payment-qr.jpeg"
          upiId={process.env.NEXT_PUBLIC_UPI_ID || ""}
          payeeName={process.env.NEXT_PUBLIC_UPI_PAYEE_NAME || ""}
        />
      </div>
    );
  }

  const supabase = createAdminClient();

  const [
    { data: players },
    { data: teams },
    { data: gameweek },
    { data: scoredGws },
    { data: fixtures },
    { data: mySquads },
  ] = await Promise.all([
    supabase
      .from("players")
      .select(
        "id, name, position, batch, auction_team, auction_price, fantasy_price, source",
      )
      .eq("league", league)
      .order("fantasy_price", { ascending: false }),
    supabase.from("teams").select("key, club"),
    supabase
      .from("gameweeks")
      .select("*")
      .eq("is_locked", false)
      .order("match_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("gameweeks")
      .select("id, label, match_date")
      .eq("is_scored", true)
      .order("match_date", { ascending: true }),
    supabase
      .from("fixtures")
      .select("gameweek_no, home, away, home_goals, away_goals")
      .eq("league", league),
    supabase
      .from("squads")
      .select(
        "id, gameweek_id, captain_id, vice_captain_id, transfers_used, gameweeks(match_date)",
      )
      .eq("profile_id", manager.id)
      .eq("league", league),
  ]);

  // Season stats per player, from scored gameweeks only, with opponent and result for each gameweek.
  const scoredIds = (scoredGws || []).map((g) => g.id);
  const playerIds = (players || []).map((p) => p.id);
  const current = (mySquads || []).find((s) => s.gameweek_id === gameweek?.id);
  const previous = (mySquads || [])
    .filter(
      (s) =>
        s.gameweek_id !== gameweek?.id &&
        s.gameweeks?.match_date < gameweek?.match_date,
    )
    .sort((a, b) =>
      (b.gameweeks?.match_date || "").localeCompare(
        a.gameweeks?.match_date || "",
      ),
    )[0];
  const source = current || previous;
  const squadIds = [...new Set([current?.id, previous?.id].filter(Boolean))];
  const [statsResult, picksResult] = await Promise.all([
    scoredIds.length && playerIds.length
      ? supabase
          .from("player_stats")
          .select(
            "player_id, gameweek_id, minutes_played, goals, assists, clean_sheet, goals_conceded, yellow_cards, red_cards, own_goals, motm",
          )
          .in("gameweek_id", scoredIds)
          .in("player_id", playerIds)
      : Promise.resolve({ data: [] }),
    squadIds.length
      ? supabase
          .from("squad_players")
          .select("squad_id, player_id, is_starting")
          .in("squad_id", squadIds)
      : Promise.resolve({ data: [] }),
  ]);
  const statRows = statsResult.data;
  const picks = picksResult.data || [];
  const baselineIds = previous
    ? picks.filter((p) => p.squad_id === previous.id).map((p) => p.player_id)
    : null;
  const existingPicks = source
    ? picks.filter((p) => p.squad_id === source.id)
    : [];

  const clubOf = {};
  (teams || []).forEach((t) => (clubOf[t.key] = t.club));
  const gwNo = (g) =>
    Number(String(g?.label || "").replace(/[^0-9]/g, "")) || null;
  const fixtureByTeamWeek = {};
  (fixtures || []).forEach((f) => {
    fixtureByTeamWeek[`${f.gameweek_no}:${f.home}`] = f;
    fixtureByTeamWeek[`${f.gameweek_no}:${f.away}`] = f;
  });
  const fixtureFor = (team, no) => fixtureByTeamWeek[`${no}:${team}`];

  const statKey = {};
  (statRows || []).forEach(
    (s) => (statKey[`${s.player_id}:${s.gameweek_id}`] = s),
  );

  function buildStats(p) {
    const history = [];
    for (const g of scoredGws || []) {
      const no = gwNo(g);
      const fx = fixtureFor(p.auction_team, no);
      const s = statKey[`${p.id}:${g.id}`];
      if (!fx && !s) continue;
      let opp = null;
      let result = null;
      if (fx) {
        const home = fx.home === p.auction_team;
        opp = `${clubOf[home ? fx.away : fx.home] || (home ? fx.away : fx.home)} (${home ? "H" : "A"})`;
        if (fx.home_goals != null && fx.away_goals != null) {
          const forG = home ? fx.home_goals : fx.away_goals;
          const agG = home ? fx.away_goals : fx.home_goals;
          result = `${forG > agG ? "W" : forG < agG ? "L" : "D"} ${forG}-${agG}`;
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
      });
    }
    if (!history.length) return null;
    const sum = (k) =>
      history.reduce(
        (a, h) => a + (typeof h[k] === "boolean" ? (h[k] ? 1 : 0) : h[k]),
        0,
      );
    const apps = sum("played");
    const points = sum("points");
    return {
      history,
      apps,
      points,
      goals: sum("goals"),
      assists: sum("assists"),
      cleanSheets: sum("cleanSheet"),
      yellows: sum("yellows"),
      reds: sum("reds"),
      motm: sum("motm"),
      perMatch: apps ? Math.round((points / apps) * 10) / 10 : 0,
      form: history[history.length - 1].points,
    };
  }

  const openNo = gwNo(gameweek);
  const withClub = (players || []).map((p) => {
    const nf = openNo ? fixtureFor(p.auction_team, openNo) : null;
    const nextHome = nf && nf.home === p.auction_team;
    return {
      ...p,
      club: clubOf[p.auction_team] || p.auction_team || "",
      stats: buildStats(p),
      next: nf
        ? `${clubOf[nextHome ? nf.away : nf.home] || (nextHome ? nf.away : nf.home)} (${nextHome ? "H" : "A"})`
        : null,
    };
  });

  if (!gameweek) {
    return (
      <div className="pt-16 text-center">
        <p className="font-display text-3xl text-chalk mb-2">
          NO OPEN GAMEWEEK
        </p>
        <p className="text-chalk/60">
          Squad selection isn&apos;t open right now. Check back once the next
          matchday is announced.
        </p>
      </div>
    );
  }

  // Current squad for this gameweek, or carry over the most recent earlier squad.
  const existingSquad = source;

  return (
    <div>
      <div className="pt-4 mb-6">
        <LeagueTabs league={league} base="/squad" />
      </div>
      <SquadBuilder
        players={withClub}
        gameweek={gameweek}
        league={league}
        manager={{ id: manager.id, name: manager.display_name }}
        existingSquad={existingSquad}
        existingPicks={existingPicks}
        savedForThisGw={!!current}
        budget={Number(manager.budget) || BUDGET}
        testMode={TEST_MODE}
        baselineIds={baselineIds}
      />
    </div>
  );
}
