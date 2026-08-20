import assert from "node:assert/strict";
import { test } from "node:test";
import { applyLoss, atRiskFrom, spendableFrom, tradeTake } from "./faab.ts";
import { payoutMultiplier } from "./wagers.ts";

// Pure book math runs without a DB. SQL wrappers for spendable / atRisk still
// need a PGLite fixture; the math itself is proven via spendableFrom / atRiskFrom.

test("payoutMultiplier is the fair inverse, clamped to [0.05, 0.95]", () => {
  assert.equal(payoutMultiplier(0.25), 3);
  assert.equal(payoutMultiplier(0.75), 0.33);
  assert.equal(payoutMultiplier(0.01), payoutMultiplier(0.05));
  assert.equal(payoutMultiplier(0.99), payoutMultiplier(0.95));
});

test("spendable subtracts live stakes from the headline purse", () => {
  // Live SQL still needs a PGLite fixture; the math is no longer skipped.
  assert.equal(spendableFrom(100, 70), 30);
});

test("atRisk sums placed-wager stakes", () => {
  // Live SQL still needs a PGLite fixture; the math is no longer skipped.
  assert.equal(atRiskFrom([70, 10]), 80);
});

test("lost wager pools only what the purse had (no mint)", () => {
  // Was: claim $80 then lose $70 on a $100 purse pooled the full $70 and
  // minted $50 (remaining 0 + pool 270 + burned 80 = 350 ≠ genesis 300).
  // applyLoss + spendable award closed that path.
  const afterClaim = 20;
  const pool = 200;
  const burned = 80;
  const genesis = 300;
  const { remaining, poolCredit } = applyLoss(afterClaim, 70);
  assert.equal(poolCredit, 20);
  assert.equal(remaining, 0);
  assert.equal(remaining + (pool + poolCredit) + burned, genesis);
});

test("FAAB trade refuses when sender cannot cover (no mint)", () => {
  // Was: propose $30 while spendable was 30, then stake/claim left remaining
  // $20; execute debited greatest(0, 20-30)=0 and credited +30 → genesis +10.
  // tradeTake refuses; executeTrade pre-pass throws before any asset writes.
  assert.equal(tradeTake(20, 30), -1);
});
