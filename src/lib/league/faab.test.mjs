import assert from "node:assert/strict";
import { test } from "node:test";
import { applyLoss, tradeTake } from "./faab.ts";

test("applyLoss(100, 70) takes the full stake", () => {
  assert.deepEqual(applyLoss(100, 70), { remaining: 30, poolCredit: 70 });
});

test("applyLoss(20, 70) pools only what the purse had", () => {
  assert.deepEqual(applyLoss(20, 70), { remaining: 0, poolCredit: 20 });
});

test("applyLoss(0, 70) credits nothing", () => {
  assert.deepEqual(applyLoss(0, 70), { remaining: 0, poolCredit: 0 });
});

test("tradeTake covers exact spendable", () => {
  assert.equal(tradeTake(30, 30), 30);
});

test("tradeTake refuses when purse is short", () => {
  assert.equal(tradeTake(20, 30), -1);
});

test("tradeTake of zero is a no-op transfer", () => {
  assert.equal(tradeTake(20, 0), 0);
});
