import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyBook, presetOf, type ScoringBook } from "@/lib/league/scoring";
import { byeWeeks } from "./byes.server";
import { isHostedLeague, type Projection } from "./types";

const WEEKS = 18;

/**
 * A projection, honestly labelled.
 *
 * There is no projection feed anywhere in this app, so this is not a model: it
 * is last season's points per game, scored with THIS league's book, then zeroed
 * for anyone who cannot play. That is a proxy, and the UI says so. It is enough
 * to rank a bench, which is all the auto-fill needs it for.
 */

type StatSeed = Record<string, number> & { player_id: string };

let seed: StatSeed[] | null = null;
let byId: Map<string, StatSeed> | null = null;

function loadSeed(): Map<string, StatSeed> {
  if (byId) return byId;
  seed = JSON.parse(
    readFileSync(join(process.cwd(), "data/stats-2025.json"), "utf8"),
  ) as StatSeed[];
  byId = new Map(seed.map((r) => [r.player_id, r]));
  return byId;
}

const META_KEYS = new Set(["player_id", "gp", "pts_ppr", "pts_half_ppr", "pts_std", "pos_rank_ppr"]);
function components(row: StatSeed): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!META_KEYS.has(k) && typeof v === "number") out[k] = v;
  }
  return out;
}

/** Anyone with one of these cannot help you this week. */
const CANNOT_PLAY = new Set(["out", "ir", "doubtful", "suspended", "pup", "na", "dnr"]);

export async function scoringBookFor(leagueId: string): Promise<ScoringBook> {
  if (isHostedLeague(leagueId)) {
    const eng = await import("@/lib/league/engine.server");
    const bundle = await eng.loadLeagueBundle(leagueId, null);
    return (bundle.league.scoring_settings ?? {}) as ScoringBook;
  }
  const sleeper = await import("./sleeper.server");
  const bundle = await sleeper.loadLeagueBundle(leagueId);
  return (bundle.league.scoring_settings ?? {}) as ScoringBook;
}

/** Season points per game under a book. Null when we have no season for them. */
export function perGameUnder(book: ScoringBook, playerId: string): number | null {
  const row = loadSeed().get(playerId);
  if (!row) return null;
  const gp = Number(row.gp ?? 0);
  if (gp <= 0) return null;

  const parts = components(row);
  const hasParts = Object.values(parts).some((v) => v !== 0);
  if (hasParts) return round1(applyBook(book, parts) / gp);

  // Kickers and defences are in the file with correct totals but no component
  // splits, so scoring them from parts yields a false zero. Fall back to the
  // precomputed total for the closest preset. Exact for K and DST, since their
  // scoring does not vary with reception rules; a league with custom kicker
  // values will be slightly off until per-week stats cover them.
  const preset = presetOf(book);
  const total =
    preset === "ppr" ? row.pts_ppr : preset === "half" ? row.pts_half_ppr : row.pts_std;
  if (typeof total !== "number" || total === 0) return null;
  return round1(total / gp);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Mean and spread for a whole roster at once.
 *
 * The eighteen weekly stat maps are fetched once and reused for every player,
 * because they are league-wide files. Doing this per player would refetch the
 * same eighteen files for each of eighteen starters.
 */
export async function outlooksFor(input: {
  leagueId: string;
  season: string;
  playerIds: string[];
}): Promise<Record<string, { mean: number; sd: number }>> {
  const book = await scoringBookFor(input.leagueId);
  const live = await import("./live.server");

  const weeks = await Promise.all(
    Array.from({ length: WEEKS }, async (_, i) => {
      try {
        return await live.fetchWeekStats(input.season, i + 1, "regular");
      } catch {
        return {} as Record<string, Record<string, number>>;
      }
    }),
  );

  const out: Record<string, { mean: number; sd: number }> = {};
  for (const id of input.playerIds) {
    const points: number[] = [];
    for (const week of weeks) {
      const line = week[id];
      if (line) points.push(applyBook(book, line));
    }
    if (points.length >= 4) {
      const mean = points.reduce((t, v) => t + v, 0) / points.length;
      const variance = points.reduce((t, v) => t + (v - mean) ** 2, 0) / (points.length - 1);
      out[id] = { mean: round1(mean), sd: round1(Math.sqrt(variance)) };
      continue;
    }
    // Too little history to measure. Fall back to the season line and the
    // league-wide spread ratio rather than pretending to know.
    const pg = perGameUnder(book, id);
    out[id] = pg == null ? { mean: 0, sd: 0 } : { mean: pg, sd: round1(pg * SPREAD_RATIO) };
  }
  return out;
}

/**
 * When a player has no usable history, fall back to the league-wide ratio of
 * spread to mean. Measured across 336 scoring players in the bundled season:
 * the median is 0.63.
 */
export const SPREAD_RATIO = 0.63;

export async function projectPlayers(input: {
  leagueId: string;
  season: string;
  week: number;
  players: { player_id: string; team?: string | null; injury_status?: string | null; status?: string | null }[];
}): Promise<Record<string, Projection>> {
  const book = await scoringBookFor(input.leagueId);
  const byes = await byeWeeks(input.season).catch(() => ({}) as Record<string, number>);
  const out: Record<string, Projection> = {};

  for (const p of input.players) {
    const team = p.team ? p.team.toUpperCase() : null;
    if (team && byes[team] === input.week) {
      out[p.player_id] = { points: 0, reason: "bye" };
      continue;
    }
    const s = (p.injury_status ?? p.status ?? "").toLowerCase().trim();
    if (s && CANNOT_PLAY.has(s)) {
      out[p.player_id] = { points: 0, reason: "out" };
      continue;
    }
    const pg = perGameUnder(book, p.player_id);
    out[p.player_id] = pg == null ? { points: 0, reason: "no-data" } : { points: pg, reason: null };
  }
  return out;
}
