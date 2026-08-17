import { canonTeam } from "./teams";

/**
 * Bye weeks, derived rather than stored.
 *
 * No data source in this app carries a bye week: the Sleeper player dump has no
 * such field and there is no schedule file. But the ESPN scoreboard returns
 * every game for a given week, so a team missing from a week's slate is on bye.
 * Walk the weeks once, diff the teams, done — no new dependency.
 */

const BYE_MIN = 4;
const BYE_MAX = 15;

/** A slate this thin means ESPN gave us a partial answer, not a bye-heavy week. */
const MIN_TEAMS_FOR_A_TRUSTWORTHY_WEEK = 20;

type Cached = { at: number; map: Record<string, number> };
const cache = new Map<string, Cached>();

/** Byes do not move once the schedule is out. Twelve hours is plenty. */
const TTL = 12 * 60 * 60 * 1000;

export async function byeWeeks(season: string): Promise<Record<string, number>> {
  const hit = cache.get(season);
  if (hit && Date.now() - hit.at < TTL) return hit.map;

  const espn = await import("./espn.server");
  const present = new Map<number, Set<string>>();
  const seen = new Set<string>();

  const weeks = Array.from({ length: BYE_MAX - BYE_MIN + 1 }, (_, i) => BYE_MIN + i);
  const boards = await Promise.all(
    weeks.map(async (week) => {
      try {
        const board = await espn.fetchScoreboard({
          week,
          season: Number(season),
          seasonType: 2,
        });
        return { week, games: board.games };
      } catch {
        return { week, games: [] };
      }
    }),
  );

  for (const { week, games } of boards) {
    const teams = new Set<string>();
    for (const g of games) {
      for (const abbr of [g.home.abbr, g.away.abbr]) {
        const t = canonTeam(abbr) ?? abbr?.toUpperCase();
        if (t && t !== "—") teams.add(t);
      }
    }
    // A week we could not fetch, or one ESPN answered thinly, must not be read
    // as "everybody missing here is on bye".
    if (teams.size < MIN_TEAMS_FOR_A_TRUSTWORTHY_WEEK) continue;
    present.set(week, teams);
    for (const t of teams) seen.add(t);
  }

  const map: Record<string, number> = {};
  if (present.size === 0) {
    cache.set(season, { at: Date.now(), map });
    return map;
  }

  for (const team of seen) {
    const missing = [...present.entries()]
      .filter(([, teams]) => !teams.has(team))
      .map(([week]) => week);
    // Exactly one gap is a bye. Two or more means our window is incomplete, and
    // guessing which one is worse than saying nothing.
    if (missing.length === 1) map[team] = missing[0]!;
  }

  cache.set(season, { at: Date.now(), map });
  return map;
}

/** Convenience for a single team. Null when unknown, never a guess. */
export async function byeWeekFor(
  season: string,
  team: string | null | undefined,
): Promise<number | null> {
  if (!team) return null;
  const map = await byeWeeks(season);
  const key = canonTeam(team) ?? team.toUpperCase();
  return map[key] ?? null;
}
