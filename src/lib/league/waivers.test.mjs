import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  leagueWaiversOpen,
  playerAvailability,
  reverseStandingsOrder,
  rotateRollingOrder,
} from "./waivers.ts";

test("league window is closed after the week's run, and always closed for none", () => {
  assert.equal(leagueWaiversOpen("faab", 0, 1), true);
  assert.equal(leagueWaiversOpen("faab", 1, 1), false);
  assert.equal(leagueWaiversOpen("rolling", 1, 2), true);
  assert.equal(leagueWaiversOpen("none", 0, 1), false);
});

test("a drop after process stays on waivers even though the week window closed", () => {
  assert.equal(
    playerAvailability({
      owned: false,
      waiverType: "faab",
      lastWaiverWeek: 1,
      currentWeek: 1,
      held: true,
    }),
    "waiver",
  );
  assert.equal(
    playerAvailability({
      owned: false,
      waiverType: "faab",
      lastWaiverWeek: 1,
      currentWeek: 1,
      held: false,
    }),
    "free_agent",
  );
});

test("unowned players are on waivers while the week window is open", () => {
  assert.equal(
    playerAvailability({
      owned: false,
      waiverType: "faab",
      lastWaiverWeek: 0,
      currentWeek: 1,
      held: false,
    }),
    "waiver",
  );
});

test("none is always free agency", () => {
  assert.equal(
    playerAvailability({
      owned: false,
      waiverType: "none",
      lastWaiverWeek: 0,
      currentWeek: 1,
      held: true,
    }),
    "free_agent",
  );
});

test("FAAB tie-break is reverse standings (worst record first)", () => {
  const order = reverseStandingsOrder([
    { rosterId: 1, wins: 3, pf: 400 },
    { rosterId: 2, wins: 1, pf: 300 },
    { rosterId: 3, wins: 1, pf: 200 },
    { rosterId: 4, wins: 3, pf: 350 },
  ]);
  assert.deepEqual(order, [3, 2, 4, 1]);
});

test("rolling sends unique winners to the back", () => {
  assert.deepEqual(rotateRollingOrder([1, 2, 3, 4], [2, 2, 4]), [1, 3, 2, 4]);
  assert.deepEqual(rotateRollingOrder([1, 2, 3], []), [1, 2, 3]);
});
