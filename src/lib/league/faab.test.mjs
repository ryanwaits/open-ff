import assert from "node:assert/strict";
import { test } from "node:test";
import { applyLoss } from "./faab.ts";

test("applyLoss(100, 70) takes the full stake", () => {
  assert.deepEqual(applyLoss(100, 70), { remaining: 30, poolCredit: 70 });
});

test("applyLoss(20, 70) pools only what the purse had", () => {
  assert.deepEqual(applyLoss(20, 70), { remaining: 0, poolCredit: 20 });
});

test("applyLoss(0, 70) credits nothing", () => {
  assert.deepEqual(applyLoss(0, 70), { remaining: 0, poolCredit: 0 });
});
