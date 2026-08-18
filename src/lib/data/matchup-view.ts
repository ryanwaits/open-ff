import { formatStatLine } from "./statline";
import type { GameChip, MatchupPair, MatchupSide, Projection, StarterLine } from "./types";

export function gameHasStarted(game: GameChip | null | undefined): boolean {
  return game?.state === "in" || game?.state === "post";
}

export type SlotDisplay = {
  points: number | null;
  forecast?: "proj" | "bye" | "out";
};

/** Per-player: unofficial once their game is up; weekly proj until then. */
export function slotDisplay(
  game: GameChip | null | undefined,
  livePoints: number | null | undefined,
  projection?: Projection | null,
): SlotDisplay {
  if (gameHasStarted(game)) {
    return { points: livePoints ?? 0 };
  }
  if (projection && projection.reason !== "no-data") {
    const forecast =
      projection.reason === "bye" || projection.reason === "out" ? projection.reason : "proj";
    return { points: projection.points, forecast };
  }
  if (livePoints != null && livePoints !== 0) return { points: livePoints };
  return { points: livePoints ?? null };
}

/** Stat line only after kickoff, and only when something actually happened. */
export function liveStatLine(
  pos: string | null | undefined,
  game: GameChip | null | undefined,
  bag: Record<string, number> | null | undefined,
): string | null {
  if (!gameHasStarted(game)) return null;
  return formatStatLine(pos, bag);
}

function paintLine(
  line: StarterLine,
  projections: Record<string, Projection>,
  liveStats: Record<string, Record<string, number>>,
): StarterLine {
  const started = gameHasStarted(line.game);
  const bag = started
    ? (line.stats ?? (line.playerId ? liveStats[line.playerId] : undefined))
    : undefined;
  const disp = slotDisplay(
    line.game,
    line.points,
    line.playerId ? projections[line.playerId] : undefined,
  );
  return {
    ...line,
    points: disp.points,
    forecast: disp.forecast,
    stats: bag ?? null,
  };
}

function paintSide(
  side: MatchupSide,
  projections: Record<string, Projection>,
  liveStats: Record<string, Record<string, number>>,
): MatchupSide {
  const starters = side.starters.map((line) => paintLine(line, projections, liveStats));
  return {
    ...side,
    starters,
    points: starters.reduce((sum, line) => sum + (line.points ?? 0), 0),
  };
}

/**
 * Board-facing pair: each starter keeps last year's bag / 0.0 off the row until
 * *that* player's game starts. Team total is the sum of what the slots show.
 */
export function paintMatchup(
  pair: MatchupPair,
  projections: Record<string, Projection>,
  liveStats: Record<string, Record<string, number>>,
): MatchupPair {
  return {
    ...pair,
    home: paintSide(pair.home, projections, liveStats),
    away: pair.away ? paintSide(pair.away, projections, liveStats) : null,
  };
}

export function paintMatchups(
  pairs: MatchupPair[],
  projections: Record<string, Projection>,
  liveStats: Record<string, Record<string, number>>,
): MatchupPair[] {
  return pairs.map((pair) => paintMatchup(pair, projections, liveStats));
}

/** True when every filled starter is still a forecast — the week has not kicked. */
export function sideIsProjected(side: MatchupSide): boolean {
  const lined = side.starters.filter((s) => s.player);
  return lined.length > 0 && lined.every((s) => Boolean(s.forecast));
}

export function pairIsProjected(pair: MatchupPair): boolean {
  if (!sideIsProjected(pair.home)) return false;
  return !pair.away || sideIsProjected(pair.away);
}
