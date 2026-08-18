import assert from "node:assert/strict";
import { test } from "node:test";
import { mockPick, startMock } from "./mock-draft.ts";

const seats = Array.from({ length: 10 }, (_, i) => ({
  rosterId: i + 1,
  teamName: `T${i + 1}`,
}));

test("snake: pick 11 of 10-team → seat 10; pick 12 → seat 9", () => {
  const state = startMock({ seats, mySeat: 0, rounds: 2 });
  const p11 = state.picks.find((p) => p.pickNo === 11);
  const p12 = state.picks.find((p) => p.pickNo === 12);
  assert.equal(p11?.rosterId, 10);
  assert.equal(p12?.rosterId, 9);
  assert.equal(p11?.round, 2);
  assert.equal(p11?.slot, 1);
  assert.equal(p12?.slot, 2);
});

test("mockPick never places a taken player", () => {
  const pool = [
    { playerId: "a", name: "A", position: "RB", team: "X", pts: 20 },
    { playerId: "b", name: "B", position: "WR", team: "Y", pts: 19 },
  ];
  let state = startMock({ seats: seats.slice(0, 2), mySeat: 0, rounds: 2 });
  state = mockPick(state, pool, "a");
  assert.equal(state.picks[0]?.player?.playerId, "a");
  const blocked = mockPick(state, pool, "a");
  assert.equal(blocked.picks.filter((p) => p.player?.playerId === "a").length, 1);
  assert.equal(blocked.onClock, state.onClock);
});
