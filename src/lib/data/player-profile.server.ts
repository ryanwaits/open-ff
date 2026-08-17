import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyBook, type ScoringBook } from "@/lib/league/scoring";
import { byeWeekFor } from "./byes.server";
import type { SlimPlayer } from "./types";
import { isHostedLeague } from "./types";

export type PlayerProfile = {
  player: SlimPlayer;
  season: string;
  /** Points under THIS league's book, not a canned PPR total. */
  points: number;
  gamesPlayed: number;
  perGame: number;
  /** Rank among players at the same position, recomputed under this book. */
  posRank: number | null;
  posRankOf: number | null;
  /** Raw component totals, for the splits list. */
  splits: Record<string, number>;
  /** One entry per week; null means no game recorded. */
  weekly: (number | null)[];
  byeWeek: number | null;
  scoringNote: string;
};

type StatSeed = Record<string, number> & { player_id: string };

let seasonSeed: StatSeed[] | null = null;
function loadSeasonSeed(): StatSeed[] {
  if (seasonSeed) return seasonSeed;
  seasonSeed = JSON.parse(
    readFileSync(join(process.cwd(), "data/stats-2025.json"), "utf8"),
  ) as StatSeed[];
  return seasonSeed;
}

/** The season the bundled files describe. */
const SEED_SEASON = "2025";
const WEEKS = 18;

/** Both league kinds already surface the resolved book on the bundle. */
async function bookFor(leagueId: string): Promise<ScoringBook> {
  if (isHostedLeague(leagueId)) {
    const eng = await import("@/lib/league/engine.server");
    const bundle = await eng.loadLeagueBundle(leagueId, null);
    return (bundle.league.scoring_settings ?? {}) as ScoringBook;
  }
  const sleeper = await import("./sleeper.server");
  const bundle = await sleeper.loadLeagueBundle(leagueId);
  return (bundle.league.scoring_settings ?? {}) as ScoringBook;
}

export async function loadPlayerProfile(input: {
  leagueId: string;
  playerId: string;
  season?: string;
}): Promise<PlayerProfile | null> {
  const sleeper = await import("./sleeper.server");
  const player = sleeper.getPlayer(input.playerId);
  if (!player) return null;

  const season = input.season ?? SEED_SEASON;
  const book = await bookFor(input.leagueId);
  const seed = loadSeasonSeed();
  const mine = seed.find((r) => r.player_id === input.playerId);

  // Season totals are recomputed from raw components under the league's own
  // book, so a half-PPR league never sees a PPR number.
  const splits = mine ? stripMeta(mine) : {};
  const points = mine ? applyBook(book, splits) : 0;
  const gamesPlayed = Number(mine?.gp ?? 0);

  // Rank has to be recomputed too: a different book reorders the position.
  let posRank: number | null = null;
  let posRankOf: number | null = null;
  if (player.position) {
    const peers = seed
      .map((r) => ({ id: r.player_id, p: sleeper.getPlayer(r.player_id), pts: applyBook(book, stripMeta(r)) }))
      .filter((r) => r.p?.position === player.position);
    peers.sort((a, b) => b.pts - a.pts);
    const idx = peers.findIndex((r) => r.id === input.playerId);
    if (idx >= 0) {
      posRank = idx + 1;
      posRankOf = peers.length;
    }
  }

  const weekly = await weeklyLine(season, input.playerId, book);
  const byeWeek = await byeWeekFor(season, player.team);

  return {
    player,
    season,
    points: Math.round(points * 10) / 10,
    gamesPlayed,
    perGame: gamesPlayed > 0 ? Math.round((points / gamesPlayed) * 10) / 10 : 0,
    posRank,
    posRankOf,
    splits,
    weekly,
    byeWeek,
    scoringNote: `Scored with this league's book`,
  };
}

const META_KEYS = new Set(["player_id", "gp", "pts_ppr", "pts_half_ppr", "pts_std", "pos_rank_ppr"]);
function stripMeta(row: StatSeed): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!META_KEYS.has(k) && typeof v === "number") out[k] = v;
  }
  return out;
}

/**
 * Weekly points under the league's book. Sleeper's per-week stat maps are raw
 * components, so each week is scored the same way the season is. The bundled
 * PPR file is deliberately unused: it would be wrong in any league that is not
 * full PPR.
 */
async function weeklyLine(
  season: string,
  playerId: string,
  book: ScoringBook,
): Promise<(number | null)[]> {
  const live = await import("./live.server");
  const weeks = await Promise.all(
    Array.from({ length: WEEKS }, async (_, i) => {
      try {
        const raw = await live.fetchWeekStats(season, i + 1, "regular");
        const line = raw[playerId];
        if (!line) return null;
        return Math.round(applyBook(book, line) * 10) / 10;
      } catch {
        return null;
      }
    }),
  );
  return weeks;
}
