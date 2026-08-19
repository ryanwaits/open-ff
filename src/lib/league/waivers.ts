/**
 * Waiver window vs a single dropped player.
 *
 * The weekly flag (last_waiver_week < current_week) puts every unowned player
 * on waivers. A process run closes that flag, which used to make a drop from
 * the same run a free agent. Holds cover those drops until the next run.
 */

export function leagueWaiversOpen(
  waiverType: string | null | undefined,
  lastWaiverWeek: number,
  currentWeek: number,
): boolean {
  if ((waiverType ?? "faab") === "none") return false;
  return lastWaiverWeek < currentWeek;
}

export function playerAvailability(input: {
  owned: boolean;
  waiverType: string | null | undefined;
  lastWaiverWeek: number;
  currentWeek: number;
  held: boolean;
}): "rostered" | "waiver" | "free_agent" {
  if (input.owned) return "rostered";
  if ((input.waiverType ?? "faab") === "none") return "free_agent";
  if (input.held || leagueWaiversOpen(input.waiverType, input.lastWaiverWeek, input.currentWeek)) {
    return "waiver";
  }
  return "free_agent";
}

export type StandingSeed = { rosterId: number; wins: number; pf: number };

/** Worst record first — FAAB equal-bid tie-break. */
export function reverseStandingsOrder(standings: readonly StandingSeed[]): number[] {
  return standings
    .slice()
    .sort((a, b) => a.wins - b.wins || a.pf - b.pf || a.rosterId - b.rosterId)
    .map((s) => s.rosterId);
}

/** Rolling: unique winners go to the back, non-winners keep their order. */
export function rotateRollingOrder(
  order: readonly number[],
  winnerIds: readonly number[],
): number[] {
  if (winnerIds.length === 0) return [...order];
  const seen = new Set<number>();
  const winners: number[] = [];
  for (const id of winnerIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    winners.push(id);
  }
  return [...order.filter((id) => !seen.has(id)), ...winners];
}
