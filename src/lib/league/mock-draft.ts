/**
 * In-memory mock draft. Same snake + autopick rules as the live room;
 * nothing here touches the database.
 */

export type MockPlayer = {
  playerId: string;
  name: string;
  position: string | null;
  team: string | null;
  pts: number;
};

export type MockState = {
  seats: { rosterId: number; teamName: string }[];
  /** 0-based index into seats. */
  mySeat: number;
  rounds: number;
  picks: {
    pickNo: number;
    round: number;
    slot: number;
    rosterId: number;
    player: MockPlayer | null;
  }[];
  onClock: number;
};

export function startMock(input: {
  seats: { rosterId: number; teamName: string }[];
  mySeat: number;
  rounds: number;
}): MockState {
  const n = input.seats.length;
  const rounds = Math.max(1, input.rounds);
  const picks: MockState["picks"] = [];
  let pickNo = 1;
  for (let r = 1; r <= rounds; r++) {
    for (let o = 1; o <= n; o++) {
      // Snake: odd L→R, even R→L. Seat for (round r, order o) is o-1 on odd
      // and seats.length-o on even.
      const seatIdx = r % 2 === 1 ? o - 1 : n - o;
      const seat = input.seats[seatIdx]!;
      picks.push({
        pickNo: pickNo++,
        round: r,
        slot: o,
        rosterId: seat.rosterId,
        player: null,
      });
    }
  }
  const mySeat = Math.min(Math.max(0, input.mySeat), Math.max(0, n - 1));
  return {
    seats: input.seats,
    mySeat,
    rounds,
    picks,
    onClock: 1,
  };
}

export function mockPick(state: MockState, pool: MockPlayer[], playerId: string): MockState {
  const current = state.picks.find((p) => p.pickNo === state.onClock);
  if (!current || current.player) return state;

  const taken = new Set(state.picks.filter((p) => p.player).map((p) => p.player!.playerId));
  if (taken.has(playerId)) return state;

  const player = pool.find((p) => p.playerId === playerId);
  if (!player) return state;

  const picks = state.picks.map((p) => (p.pickNo === current.pickNo ? { ...p, player } : p));
  const next = picks.find((p) => p.player == null);
  return {
    ...state,
    picks,
    onClock: next?.pickNo ?? state.onClock,
  };
}

/**
 * Mirrors engine nextAutopick — keep in sync with the live draft autopick.
 * Needs: 1 QB, 2 RB, 2 WR, 1 TE before luxury; K/DEF late; else best pts.
 * Prefer a need only when that pos is inside the top 28 available.
 */
function nextAutopick(
  rosterId: number,
  byRoster: Map<number, MockPlayer[]>,
  ranked: MockPlayer[],
  taken: Set<string>,
): MockPlayer | null {
  const have: Record<string, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
  };
  for (const p of byRoster.get(rosterId) ?? []) {
    const pos = p.position;
    if (pos && have[pos] != null) have[pos] += 1;
  }
  const available = ranked.filter((p) => !taken.has(p.playerId));
  if (!available.length) return null;
  const needs: string[] = [];
  if (have.QB < 1) needs.push("QB");
  if (have.RB < 2) needs.push("RB");
  if (have.WR < 2) needs.push("WR");
  if (have.TE < 1) needs.push("TE");
  const n = byRoster.get(rosterId)?.length ?? 0;
  if (have.K < 1 && n >= 8) needs.push("K");
  if (have.DEF < 1 && n >= 9) needs.push("DEF");
  for (const pos of needs) {
    const idx = available.findIndex((p) => p.position === pos);
    if (idx >= 0 && idx < 28) return available[idx]!;
  }
  return available[0] ?? null;
}

function rosterMap(state: MockState): Map<number, MockPlayer[]> {
  const byRoster = new Map<number, MockPlayer[]>();
  for (const p of state.picks) {
    if (!p.player) continue;
    const arr = byRoster.get(p.rosterId) ?? [];
    arr.push(p.player);
    byRoster.set(p.rosterId, arr);
  }
  return byRoster;
}

export function runBotsUntilMyTurn(state: MockState, pool: MockPlayer[]): MockState {
  const ranked = [...pool].sort((a, b) => b.pts - a.pts);
  let s = state;
  const myRosterId = s.seats[s.mySeat]?.rosterId;
  // Cap iterations to the remaining board so a bad mirror cannot loop forever.
  for (let i = 0; i < s.picks.length; i++) {
    const current = s.picks.find((p) => p.pickNo === s.onClock);
    if (!current || current.player) break;
    if (myRosterId != null && current.rosterId === myRosterId) break;

    const taken = new Set(s.picks.filter((p) => p.player).map((p) => p.player!.playerId));
    const bot = nextAutopick(current.rosterId, rosterMap(s), ranked, taken);
    if (!bot) break;
    const next = mockPick(s, pool, bot.playerId);
    // Last pick keeps the same onClock (no empty cell left) — still commit it.
    if (next === s) break;
    s = next;
  }
  return s;
}
