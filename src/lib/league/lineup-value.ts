import type { Projection, RosterPlayer } from "@/lib/data/types";
import { labeledStartSlots, slotAccepts } from "./roster";

/**
 * What a roster actually scores, and what a trade does to it.
 *
 * Adding up the players in a trade and subtracting the players out is the
 * intuitive comparison and the wrong one: it prices a player at his whole
 * total rather than at the gap to whoever would replace him. Trade a QB1 while
 * holding a QB2 and you lose the difference, not the score. Trade a bench
 * receiver and you lose nothing.
 *
 * So both sides are valued the same way — fill the starting lineup best-first
 * and total it — and the answer is the difference. Mirrors applyLineup() in
 * the league engine (server), which does the same greedy fill for the server
 * paths. Slot-rule changes must stay in sync in both places.
 */

export type FilledSlot = { slot: string; player: RosterPlayer | null; points: number };

export type LineupValue = {
  slots: FilledSlot[];
  total: number;
};

/** Greedy best-first fill. Highest projection takes the first slot it fits. */
export function fillLineup(
  players: RosterPlayer[],
  rosterPositions: string[],
  projections: Record<string, Projection>,
): LineupValue {
  const labeled = labeledStartSlots(rosterPositions);
  const pts = (id: string) => projections[id]?.points ?? 0;
  const byPts = [...players].sort((a, b) => {
    const d = pts(b.player_id) - pts(a.player_id);
    if (d !== 0) return d;
    return a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0;
  });

  const used = new Set<string>();
  const slots: FilledSlot[] = [];
  let total = 0;

  for (const { label } of labeled) {
    const pick = byPts.find((p) => !used.has(p.player_id) && slotAccepts(p.position, label));
    if (!pick) {
      slots.push({ slot: label, player: null, points: 0 });
      continue;
    }
    used.add(pick.player_id);
    const points = pts(pick.player_id);
    slots.push({ slot: label, player: pick, points });
    total += points;
  }

  return { slots, total };
}

export type TradeDelta = {
  before: LineupValue;
  after: LineupValue;
  /** after.total - before.total, rounded to one decimal. */
  change: number;
  /** Only slots whose occupant changed. An unchanged row is noise. */
  changed: Array<{
    slot: string;
    from: RosterPlayer | null;
    to: RosterPlayer | null;
    delta: number;
  }>;
};

/** What a trade does to one roster. `incoming` may include players from any team. */
export function tradeDelta(input: {
  players: RosterPlayer[];
  rosterPositions: string[];
  projections: Record<string, Projection>;
  outgoingIds: string[];
  incoming: RosterPlayer[];
}): TradeDelta {
  const { players, rosterPositions, projections, outgoingIds, incoming } = input;
  const out = new Set(outgoingIds);
  const before = fillLineup(players, rosterPositions, projections);
  const afterPlayers = [...players.filter((p) => !out.has(p.player_id)), ...incoming];
  const after = fillLineup(afterPlayers, rosterPositions, projections);

  const changed: TradeDelta["changed"] = [];
  const n = Math.max(before.slots.length, after.slots.length);
  for (let i = 0; i < n; i++) {
    const b = before.slots[i];
    const a = after.slots[i];
    if (!b || !a) continue;
    const fromId = b.player?.player_id ?? null;
    const toId = a.player?.player_id ?? null;
    if (fromId === toId) continue;
    changed.push({
      slot: a.slot,
      from: b.player,
      to: a.player,
      delta: a.points - b.points,
    });
  }

  const change = Math.round((after.total - before.total) * 10) / 10;
  return { before, after, change, changed };
}
