import type { GameChip, ScoreGame } from "./types";
import { canonTeam, teamKeys } from "./teams";

export function seasonTypeNum(seasonType?: string | null): number {
  if (seasonType === "pre") return 1;
  if (seasonType === "post") return 3;
  return 2;
}

export function indexGames(games: ScoreGame[]): Map<string, GameChip> {
  const out = new Map<string, GameChip>();
  for (const g of games) {
    const homeAbbr = canonTeam(g.home.abbr) ?? g.home.abbr.toUpperCase();
    const awayAbbr = canonTeam(g.away.abbr) ?? g.away.abbr.toUpperCase();
    const live =
      g.state === "in"
        ? {
            possession: g.possession ?? null,
            situation: g.situation ?? null,
            redZone: Boolean(g.redZone),
          }
        : { possession: null, situation: null, redZone: false };
    const homeChip: GameChip = {
      state: g.state,
      detail: g.detail,
      opp: `vs ${awayAbbr}`,
      gameId: g.id,
      ...live,
    };
    const awayChip: GameChip = {
      state: g.state,
      detail: g.detail,
      opp: `@ ${homeAbbr}`,
      gameId: g.id,
      ...live,
    };
    for (const key of teamKeys(g.home.abbr)) out.set(key, homeChip);
    for (const key of teamKeys(g.away.abbr)) out.set(key, awayChip);
  }
  return out;
}

export function gameForTeam(
  index: Map<string, GameChip>,
  team: string | null | undefined,
): GameChip | null {
  if (!team) return null;
  const u = team.toUpperCase();
  return index.get(u) ?? index.get(canonTeam(u) ?? u) ?? null;
}

const pointsCache = new Map<string, { at: number; data: Record<string, number> }>();
const statsCache = new Map<string, { at: number; data: Record<string, Record<string, number>> }>();

/** Unofficial Sleeper weekly points. Short TTL so Sunday games tick. */
export async function fetchWeekPoints(
  season: string,
  week: number,
  scoring: "ppr" | "half" | "std" | string,
  seasonType: string = "regular",
): Promise<Record<string, number>> {
  const kind = seasonType === "pre" || seasonType === "post" ? seasonType : "regular";
  const key = `${kind}:${season}:${week}:${scoring}`;
  const hit = pointsCache.get(key);
  if (hit && Date.now() - hit.at < 12_000) return hit.data;
  const raw = await fetchWeekStats(season, week, kind);
  const statKey = scoring === "std" ? "pts_std" : scoring === "half" ? "pts_half_ppr" : "pts_ppr";
  const data: Record<string, number> = {};
  for (const [id, row] of Object.entries(raw)) {
    const pts = row?.[statKey];
    if (typeof pts === "number") data[id] = pts;
  }
  pointsCache.set(key, { at: Date.now(), data });
  return data;
}

export async function fetchWeekStats(
  season: string,
  week: number,
  seasonType: string = "regular",
): Promise<Record<string, Record<string, number>>> {
  const kind = seasonType === "pre" || seasonType === "post" ? seasonType : "regular";
  const key = `raw:${kind}:${season}:${week}`;
  const hit = statsCache.get(key);
  if (hit && Date.now() - hit.at < 12_000) return hit.data;
  const res = await fetch(`https://api.sleeper.app/v1/stats/nfl/${kind}/${season}/${week}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) return hit?.data ?? {};
  const raw = ((await res.json()) as Record<string, Record<string, number>>) ?? {};
  statsCache.set(key, { at: Date.now(), data: raw });
  return raw;
}

const boardCache = new Map<string, { at: number; data: Awaited<ReturnType<typeof weekBoardUncached>> }>();

async function weekBoardUncached(season: string, week: number, seasonType?: string | null) {
  const espn = await import("./espn.server");
  const board = await espn.fetchScoreboard({
    week,
    season: Number(season) || undefined,
    seasonType: seasonTypeNum(seasonType),
  });
  const index = indexGames(board.games);
  return {
    live: board.games.some((g) => g.state === "in"),
    index,
    games: board.games,
  };
}

export async function weekBoard(season: string, week: number, seasonType?: string | null) {
  const key = `${season}:${week}:${seasonType ?? ""}`;
  const hit = boardCache.get(key);
  if (hit && Date.now() - hit.at < 12_000) return hit.data;
  const data = await weekBoardUncached(season, week, seasonType);
  boardCache.set(key, { at: Date.now(), data });
  return data;
}
