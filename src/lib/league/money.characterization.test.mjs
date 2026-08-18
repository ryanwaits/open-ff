import assert from "node:assert/strict";
import { test } from "node:test";
import { atRisk, payoutMultiplier, spendable } from "./wagers.server.ts";

// Pure book math runs without a DB. spendable / atRisk / placeWager / settleWeek
// all call getSql(); bun has no import.meta.glob so PGLite migrate cannot boot
// without Vite. Live conservation cases stay skipped — needs PGLite fixture.

test("payoutMultiplier is the fair inverse, clamped to [0.05, 0.95]", () => {
  assert.equal(payoutMultiplier(0.25), 3);
  assert.equal(payoutMultiplier(0.75), 0.33);
  assert.equal(payoutMultiplier(0.01), payoutMultiplier(0.05));
  assert.equal(payoutMultiplier(0.99), payoutMultiplier(0.95));
});

test.skip("spendable subtracts live stakes from the headline purse", () => {
  // needs PGLite fixture
  void spendable;
});

test.skip("atRisk sums placed-wager stakes", () => {
  // needs PGLite fixture
  void atRisk;
});

test.skip("current: claim then lose can mint pool dollars", () => {
  // needs PGLite fixture
  //
  // Seed: one league, one roster at $100, pool at $200 (genesis = 300).
  // Place a $70 wager, file an $80 claim, award the claim, settle the wager as a loss.
  //
  // WANT: after a $70 lost wager and an $80 winning claim on a $100 purse,
  // remaining + pool + burned_claims === genesis. TODAY: pool is credited
  // the full $70 even when remaining only had $20 (wagers.server.ts:474-479).
  //
  // Actual numbers today (assert these so 023 fails on purpose when it fixes):
  //   award $80 claim first → remaining 20, pool 200
  //   lose $70: remaining = greatest(0, 20-70) = 0, pool += 70 → 270
  //   remaining(0) + pool(270) + burned_claims(80) = 350, not 300. Minted $50.
});
