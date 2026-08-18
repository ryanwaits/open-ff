import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSql } from "@/lib/db";
import { getPlayer, playerName } from "@/lib/data/sleeper.server";
import { readEvents, type StoredEvent } from "./events.server";

/**
 * Standing facts about a league, rolled up from ff_events and ff_week_results.
 *
 * The desk cannot be handed four months of raw events, and a bare aggregate
 * ("h2h: 4-0") still needs interpreting. So each fact carries both the numbers
 * and a plain sentence, and the consumer picks whichever it needs.
 */
export type LeagueFact = {
  /** Stable key so a consumer can prefer or suppress a kind of fact. */
  kind:
    | "head_to_head"
    | "close_losses"
    | "waiver_spend"
    | "waiver_heartbreak"
    | "bench_regret"
    | "book_record"
    | "injury_luck";
  /** Teams this is about, for attribution. */
  teams: string[];
  /** Plain sentence, already written. */
  text: string;
  /** The raw numbers behind it, so a consumer can re-phrase. */
  data: Record<string, number | string>;
};

export type LeagueFacts = {
  leagueId: string;
  throughWeek: number;
  facts: LeagueFact[];
};

type RosterRow = { roster_id: number; team_name: string };
type MatchupRow = { week: number; home_roster: number; away_roster: number | null };
type ResultRow = {
  week: number;
  roster_id: number;
  points: number;
  starters_json: string;
};
type SpotRow = { roster_id: number; player_id: string; slot: string };
type StarterLine = { playerId: string; points: number };

let weeklyPprCache: Record<string, Record<string, number>> | null = null;

function loadWeeklyPpr(): Record<string, Record<string, number>> {
  if (!weeklyPprCache) {
    weeklyPprCache = JSON.parse(
      readFileSync(join(process.cwd(), "data/weekly-ppr-2025.json"), "utf8"),
    ) as Record<string, Record<string, number>>;
  }
  return weeklyPprCache;
}

function parseStarters(raw: string): StarterLine[] {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const r = row as { playerId?: unknown; points?: unknown };
        if (typeof r.playerId !== "string" || !r.playerId) return null;
        const points = typeof r.points === "number" && Number.isFinite(r.points) ? r.points : 0;
        return { playerId: r.playerId, points };
      })
      .filter((x): x is StarterLine => x != null);
  } catch {
    return [];
  }
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function recordText(wins: number, losses: number, ties: number): string {
  if (ties > 0) return `${wins}–${losses}–${ties}`;
  return `${wins}–${losses}`;
}

/**
 * Roll the ledger and week results into standing facts for the desk.
 *
 * Facts that miss their threshold are omitted. An empty list is correct for a
 * league with nothing yet worth saying.
 */
export async function loadLeagueFacts(
  leagueId: string,
  throughWeek: number,
): Promise<LeagueFacts> {
  const sql = await getSql();
  const weekCap = Math.max(0, Math.floor(throughWeek));

  const [rosters, matchups, results, spots, leagueRows] = await Promise.all([
    sql<RosterRow>`
      select roster_id, team_name from ff_rosters
      where league_id = ${leagueId}
      order by roster_id
    `,
    sql<MatchupRow>`
      select week, home_roster, away_roster from ff_matchups
      where league_id = ${leagueId} and week <= ${weekCap}
      order by week, home_roster
    `,
    sql<ResultRow>`
      select week, roster_id, points, starters_json from ff_week_results
      where league_id = ${leagueId} and week <= ${weekCap}
    `,
    sql<SpotRow>`
      select roster_id, player_id, slot from ff_spots
      where league_id = ${leagueId}
    `,
    sql<{ season: string; scoring: string }>`
      select season, scoring from ff_leagues where id = ${leagueId}
    `,
  ]);

  const events = (await readEvents(leagueId, { limit: 2000 })).filter(
    (e) => e.week <= weekCap,
  );

  const teamName = new Map(rosters.map((r) => [r.roster_id, r.team_name]));
  const nameOf = (id: number) => teamName.get(id) ?? `Roster ${id}`;

  const locked = new Map<string, { points: number; starters: StarterLine[] }>();
  for (const r of results) {
    locked.set(`${r.week}:${r.roster_id}`, {
      points: Number(r.points) || 0,
      starters: parseStarters(r.starters_json),
    });
  }

  const spotsByRoster = new Map<number, SpotRow[]>();
  for (const s of spots) {
    const arr = spotsByRoster.get(s.roster_id) ?? [];
    arr.push(s);
    spotsByRoster.set(s.roster_id, arr);
  }

  const season = leagueRows[0]?.season ?? "2025";
  const scoring = leagueRows[0]?.scoring ?? "ppr";
  const weekPtsCache = new Map<number, Record<string, number>>();

  function weekPts(week: number): Record<string, number> {
    const hit = weekPtsCache.get(week);
    if (hit) return hit;
    let pts: Record<string, number> = {};
    if (season === "2025" && scoring === "ppr") {
      pts = loadWeeklyPpr()[String(week)] ?? {};
    }
    weekPtsCache.set(week, pts);
    return pts;
  }

  function pointsFor(rosterId: number, week: number): number | null {
    const hit = locked.get(`${week}:${rosterId}`);
    if (hit) return hit.points;
    const pts = weekPts(week);
    let sum = 0;
    let any = false;
    for (const s of spotsByRoster.get(rosterId) ?? []) {
      if (s.slot !== "starter") continue;
      any = true;
      sum += pts[s.player_id] ?? 0;
    }
    return any ? sum : null;
  }

  const facts: LeagueFact[] = [];
  facts.push(...headToHeadFacts(matchups, pointsFor, nameOf));
  facts.push(...closeLossFacts(matchups, pointsFor, nameOf));
  facts.push(...waiverSpendFacts(events, nameOf));
  facts.push(...waiverHeartbreakFacts(events, nameOf));
  facts.push(
    ...benchRegretFacts({
      matchups,
      locked,
      spotsByRoster,
      weekPts,
      nameOf,
      throughWeek: weekCap,
    }),
  );
  facts.push(...bookRecordFacts(events, nameOf));
  facts.push(...injuryLuckFacts(events, nameOf));

  return { leagueId, throughWeek: weekCap, facts };
}

function headToHeadFacts(
  matchups: MatchupRow[],
  pointsFor: (rosterId: number, week: number) => number | null,
  nameOf: (id: number) => string,
): LeagueFact[] {
  type Pair = {
    a: number;
    b: number;
    aWins: number;
    bWins: number;
    ties: number;
    meetings: number;
  };
  const pairs = new Map<string, Pair>();

  for (const m of matchups) {
    if (m.away_roster == null) continue;
    const hp = pointsFor(m.home_roster, m.week);
    const ap = pointsFor(m.away_roster, m.week);
    if (hp == null || ap == null) continue;
    if (hp === 0 && ap === 0) continue;

    const key = pairKey(m.home_roster, m.away_roster);
    let pair = pairs.get(key);
    if (!pair) {
      const [a, b] =
        m.home_roster < m.away_roster
          ? [m.home_roster, m.away_roster]
          : [m.away_roster, m.home_roster];
      pair = { a, b, aWins: 0, bWins: 0, ties: 0, meetings: 0 };
      pairs.set(key, pair);
    }
    pair.meetings += 1;
    if (hp === ap) pair.ties += 1;
    else if (hp > ap) {
      if (m.home_roster === pair.a) pair.aWins += 1;
      else pair.bWins += 1;
    } else {
      if (m.away_roster === pair.a) pair.aWins += 1;
      else pair.bWins += 1;
    }
  }

  const out: LeagueFact[] = [];
  for (const p of pairs.values()) {
    if (p.meetings < 2) continue;
    const aName = nameOf(p.a);
    const bName = nameOf(p.b);
    out.push({
      kind: "head_to_head",
      teams: [aName, bName],
      text: `${aName} is ${recordText(p.aWins, p.bWins, p.ties)} against ${bName}.`,
      data: {
        meetings: p.meetings,
        wins: p.aWins,
        losses: p.bWins,
        ties: p.ties,
        opponentWins: p.bWins,
        opponentLosses: p.aWins,
      },
    });
  }
  return out;
}

function closeLossFacts(
  matchups: MatchupRow[],
  pointsFor: (rosterId: number, week: number) => number | null,
  nameOf: (id: number) => string,
): LeagueFact[] {
  const close = new Map<number, { count: number; totalMargin: number }>();

  for (const m of matchups) {
    if (m.away_roster == null) continue;
    const hp = pointsFor(m.home_roster, m.week);
    const ap = pointsFor(m.away_roster, m.week);
    if (hp == null || ap == null) continue;
    if (hp === 0 && ap === 0) continue;
    const margin = Math.abs(hp - ap);
    if (margin >= 5 || margin === 0) continue;
    const loser = hp < ap ? m.home_roster : m.away_roster;
    const cur = close.get(loser) ?? { count: 0, totalMargin: 0 };
    cur.count += 1;
    cur.totalMargin += margin;
    close.set(loser, cur);
  }

  const out: LeagueFact[] = [];
  for (const [rosterId, row] of close) {
    if (row.count < 2) continue;
    const team = nameOf(rosterId);
    out.push({
      kind: "close_losses",
      teams: [team],
      text: `${team} has lost ${row.count} games by under 5 points.`,
      data: {
        count: row.count,
        avgMargin: Number((row.totalMargin / row.count).toFixed(2)),
      },
    });
  }
  return out;
}

function waiverSpendFacts(events: StoredEvent[], nameOf: (id: number) => string): LeagueFact[] {
  let best: {
    rosterId: number;
    playerId: string;
    amount: number;
  } | null = null;

  for (const e of events) {
    if (e.kind !== "claim_won") continue;
    if (e.actorRoster == null || !e.playerId) continue;
    const amount = e.amount ?? 0;
    if (amount < 15) continue;
    if (!best || amount > best.amount) {
      best = { rosterId: e.actorRoster, playerId: e.playerId, amount };
    }
  }
  if (!best) return [];

  const team = nameOf(best.rosterId);
  const player = playerName(best.playerId);
  return [
    {
      kind: "waiver_spend",
      teams: [team],
      text: `${team} spent ${best.amount} FAAB on ${player}.`,
      data: {
        amount: best.amount,
        playerId: best.playerId,
        player,
      },
    },
  ];
}

function waiverHeartbreakFacts(
  events: StoredEvent[],
  nameOf: (id: number) => string,
): LeagueFact[] {
  const counts = new Map<number, number>();
  for (const e of events) {
    if (e.kind !== "claim_lost") continue;
    if (e.actorRoster == null) continue;
    if (e.payload?.reason !== "outbid") continue;
    counts.set(e.actorRoster, (counts.get(e.actorRoster) ?? 0) + 1);
  }

  const out: LeagueFact[] = [];
  for (const [rosterId, count] of counts) {
    if (count < 3) continue;
    const team = nameOf(rosterId);
    out.push({
      kind: "waiver_heartbreak",
      teams: [team],
      text: `${team} lost ${count} waiver claims to a higher bid.`,
      data: { count },
    });
  }
  return out;
}

function benchRegretFacts(input: {
  matchups: MatchupRow[];
  locked: Map<string, { points: number; starters: StarterLine[] }>;
  spotsByRoster: Map<number, SpotRow[]>;
  weekPts: (week: number) => Record<string, number>;
  nameOf: (id: number) => string;
  throughWeek: number;
}): LeagueFact[] {
  const weeks = new Set<number>();
  for (const m of input.matchups) {
    if (m.week <= input.throughWeek) weeks.add(m.week);
  }
  for (const key of input.locked.keys()) {
    const week = Number(key.split(":")[0]);
    if (week <= input.throughWeek) weeks.add(week);
  }

  type Hit = {
    rosterId: number;
    week: number;
    gap: number;
    benchId: string;
    starterId: string;
    benchPts: number;
    starterPts: number;
  };
  const bestByRoster = new Map<number, Hit>();
  const countByRoster = new Map<number, number>();

  for (const week of weeks) {
    const pts = input.weekPts(week);
    for (const [rosterId, rosterSpots] of input.spotsByRoster) {
      const locked = input.locked.get(`${week}:${rosterId}`);
      const starterLines: StarterLine[] =
        locked?.starters?.length
          ? locked.starters
          : rosterSpots
              .filter((s) => s.slot === "starter")
              .map((s) => ({
                playerId: s.player_id,
                points: pts[s.player_id] ?? 0,
              }));
      if (!starterLines.length) continue;

      const starterIds = new Set(starterLines.map((s) => s.playerId));
      const benchIds = rosterSpots
        .filter((s) => s.slot === "bench" || !starterIds.has(s.player_id))
        .map((s) => s.player_id)
        .filter((id) => !starterIds.has(id));

      for (const benchId of benchIds) {
        const benchPts = pts[benchId] ?? 0;
        const benchPos = getPlayer(benchId)?.position;
        if (!benchPos) continue;
        for (const starter of starterLines) {
          const starterPos = getPlayer(starter.playerId)?.position;
          if (!starterPos || starterPos !== benchPos) continue;
          const gap = benchPts - starter.points;
          if (gap < 8) continue;
          countByRoster.set(rosterId, (countByRoster.get(rosterId) ?? 0) + 1);
          const hit: Hit = {
            rosterId,
            week,
            gap,
            benchId,
            starterId: starter.playerId,
            benchPts,
            starterPts: starter.points,
          };
          const prev = bestByRoster.get(rosterId);
          if (!prev || hit.gap > prev.gap) bestByRoster.set(rosterId, hit);
        }
      }
    }
  }

  const out: LeagueFact[] = [];
  for (const hit of bestByRoster.values()) {
    const team = input.nameOf(hit.rosterId);
    const bench = playerName(hit.benchId);
    const starter = playerName(hit.starterId);
    const count = countByRoster.get(hit.rosterId) ?? 1;
    out.push({
      kind: "bench_regret",
      teams: [team],
      text: `${team} left ${bench} on the bench in week ${hit.week} while ${starter} started. The gap was ${hit.gap.toFixed(1)}.`,
      data: {
        week: hit.week,
        gap: Number(hit.gap.toFixed(2)),
        benchPoints: Number(hit.benchPts.toFixed(2)),
        starterPoints: Number(hit.starterPts.toFixed(2)),
        benchId: hit.benchId,
        starterId: hit.starterId,
        count,
      },
    });
  }
  return out;
}

function bookRecordFacts(events: StoredEvent[], nameOf: (id: number) => string): LeagueFact[] {
  const tallies = new Map<number, { won: number; lost: number }>();
  for (const e of events) {
    if (e.kind !== "wager_won" && e.kind !== "wager_lost") continue;
    if (e.actorRoster == null) continue;
    const cur = tallies.get(e.actorRoster) ?? { won: 0, lost: 0 };
    if (e.kind === "wager_won") cur.won += 1;
    else cur.lost += 1;
    tallies.set(e.actorRoster, cur);
  }

  const out: LeagueFact[] = [];
  for (const [rosterId, t] of tallies) {
    const settled = t.won + t.lost;
    if (settled < 3) continue;
    const team = nameOf(rosterId);
    out.push({
      kind: "book_record",
      teams: [team],
      text: `${team} is ${t.won}–${t.lost} against the book.`,
      data: { won: t.won, lost: t.lost, settled },
    });
  }
  return out;
}

function injuryLuckFacts(events: StoredEvent[], nameOf: (id: number) => string): LeagueFact[] {
  const counts = new Map<number, number>();
  for (const e of events) {
    if (e.kind !== "injury_changed") continue;
    if (e.actorRoster == null) continue;
    counts.set(e.actorRoster, (counts.get(e.actorRoster) ?? 0) + 1);
  }

  const out: LeagueFact[] = [];
  for (const [rosterId, count] of counts) {
    if (count < 3) continue;
    const team = nameOf(rosterId);
    out.push({
      kind: "injury_luck",
      teams: [team],
      text: `${team} had ${count} injury designation changes on rostered players.`,
      data: { count },
    });
  }
  return out;
}
