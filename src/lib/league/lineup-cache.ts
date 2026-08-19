import type { QueryClient } from "@tanstack/react-query";

/**
 * Lineup writes change the matchup board and the book. Mark those keys stale
 * here — not in `onSuccess` — so a fast tab switch cannot unmount the observer
 * before the invalidate runs. `matchups` refetches even when that tab is closed.
 */
export function invalidateAfterLineup(qc: QueryClient, leagueId: string): Promise<void> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["team", leagueId] }),
    qc.invalidateQueries({ queryKey: ["league", leagueId] }),
    qc.invalidateQueries({ queryKey: ["matchups", leagueId], refetchType: "all" }),
    qc.invalidateQueries({ queryKey: ["book", leagueId] }),
  ]).then(() => undefined);
}

/**
 * Roster membership changed (waiver award, free-agent add, drop). Team and
 * the wire must refetch; projections are keyed on player ids so they follow.
 */
export function invalidateAfterRosterMove(qc: QueryClient, leagueId: string): Promise<void> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["team", leagueId] }),
    qc.invalidateQueries({ queryKey: ["league", leagueId] }),
    qc.invalidateQueries({ queryKey: ["claims", leagueId] }),
    qc.invalidateQueries({ queryKey: ["wire", leagueId] }),
    qc.invalidateQueries({ queryKey: ["activity", leagueId] }),
    qc.invalidateQueries({ queryKey: ["matchups", leagueId], refetchType: "all" }),
    qc.invalidateQueries({ queryKey: ["projections", leagueId] }),
  ]).then(() => undefined);
}
