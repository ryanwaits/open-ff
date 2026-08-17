import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ClaimMode, ClaimTarget } from "@/components/claim-dialog";
import { getLeagueBundle, getTeam } from "@/lib/data/fns";
import type { LeagueBundle, RosterPlayer, TeamBundle } from "@/lib/data/types";
import { getClaims } from "@/lib/league/fns";

/**
 * Everything the Claim button and its dialog need to know, worked out once.
 *
 * Both the player page and the wire ask the same nine questions before they can
 * draw a button — is there a seat, has the draft finished, is the league locked,
 * is the wire in its claim window, does someone already hold him, is there a bid
 * of mine already in. Answering them in one hook is the only way the two
 * surfaces can't drift apart.
 */

export type ClaimVerdict =
  /** Nothing to offer: an import, no seat, or a locked desk. */
  | { kind: "none" }
  /** The wire is shut until the draft board is final. */
  | { kind: "predraft" }
  /** He is already yours. */
  | { kind: "mine" }
  /** Someone else holds him; a trade is the only route. */
  | { kind: "taken"; teamName: string }
  /** You have a claim in on him already. */
  | { kind: "pending"; claimId: string; bid: number; money: boolean }
  /** Pressable. `mode` decides whether it queues or lands immediately. */
  | { kind: "open"; mode: ClaimMode };

export function useClaim(leagueId: string) {
  const [target, setTarget] = useState<ClaimTarget | null>(null);

  const league = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeagueBundle({ data: { leagueId } }),
  });
  const bundle = league.data;
  const week = bundle?.currentWeek ?? 1;
  const rosterId = bundle?.myRosterId ?? null;

  const team = useQuery({
    queryKey: ["team", leagueId, rosterId, week],
    queryFn: () => getTeam({ data: { leagueId, rosterId: Number(rosterId), week } }),
    enabled: rosterId != null && Boolean(bundle),
  });

  const claims = useQuery({
    queryKey: ["claims", leagueId],
    queryFn: () => getClaims({ data: { leagueId } }),
    enabled: Boolean(bundle?.hosted),
  });

  const waiverType = bundle?.ops?.waiverType ?? "faab";
  const waiversOpen = Boolean(bundle?.ops?.waiversOpen);

  return {
    open: target != null,
    target,
    /** Hand the dialog a player; passing null closes it. */
    setTarget,
    league: bundle,
    team: team.data,
    waiverType,
    waiverPos:
      bundle && rosterId != null
        ? (bundle.standings.find((s) => s.rosterId === rosterId)?.waiverPos ?? null)
        : null,
    faabRemaining: bundle?.faabRemaining ?? 0,
    mustDrop: rosterAtCap(bundle, team.data),
    droppable: droppableFrom(team.data),
    mode: (waiversOpen ? "claim" : "add") as ClaimMode,
    /**
     * Per player, because a list draws one button per row. `ownedBy` is optional
     * — the wire only ever lists players nobody holds, so only the profile,
     * which can land on anyone, has to pass it.
     */
    verdictFor: (
      playerId: string,
      ownedBy?: { rosterId: number; teamName: string } | null,
    ): ClaimVerdict => {
      const pending = claims.data?.items.find(
        (c) => c.mine && c.status === "pending" && c.add.id === playerId,
      );
      return decide({
        bundle,
        mine: Boolean(team.data?.players.some((p) => p.player_id === playerId)),
        pending: pending ? { id: pending.id, bid: pending.bid } : null,
        ownedBy: ownedBy ?? null,
        waiversOpen,
        money: waiverType === "faab",
      });
    },
  };
}

function decide(input: {
  bundle: LeagueBundle | undefined;
  mine: boolean;
  pending: { id: string; bid: number } | null;
  ownedBy: { rosterId: number; teamName: string } | null;
  waiversOpen: boolean;
  money: boolean;
}): ClaimVerdict {
  const b = input.bundle;
  if (!b || !b.hosted || b.locked || b.myRosterId == null) return { kind: "none" };
  if (b.draftStatus !== "complete") return { kind: "predraft" };
  if (input.mine) return { kind: "mine" };
  if (input.pending) {
    return {
      kind: "pending",
      claimId: input.pending.id,
      bid: input.pending.bid,
      money: input.money,
    };
  }
  if (input.ownedBy && input.ownedBy.rosterId !== b.myRosterId) {
    return { kind: "taken", teamName: input.ownedBy.teamName };
  }
  return { kind: "open", mode: input.waiversOpen ? "claim" : "add" };
}

/**
 * The server demands a drop once the roster is at its cap, counting every shelf
 * — so this counts the same way rather than guessing from the bench alone.
 */
function rosterAtCap(bundle: LeagueBundle | undefined, team: TeamBundle | undefined): boolean {
  if (!bundle || !team) return false;
  const cap = (bundle.league.roster_positions ?? []).length || 15;
  return team.players.length >= cap;
}

/** Anyone on the roster can go, but offer the bench first — that is the usual answer. */
function droppableFrom(team: TeamBundle | undefined): RosterPlayer[] {
  if (!team) return [];
  const rank = (p: RosterPlayer) => (p.slot === "bench" ? 0 : p.slot === "starter" ? 2 : 1);
  return team.players.slice().sort((a, b) => rank(a) - rank(b));
}
