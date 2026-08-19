import assert from "node:assert/strict";
import { test } from "node:test";
import { applyLoss, atRiskFrom, spendableFrom, tradeTake } from "./faab.ts";

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

test("atRiskFrom sums stakes", () => {
  assert.equal(atRiskFrom([70, 10]), 80);
});

test("spendableFrom subtracts at-risk from the purse", () => {
  assert.equal(spendableFrom(100, 70), 30);
});

test("spendableFrom floors at zero when over-staked", () => {
  assert.equal(spendableFrom(20, 70), 0);
});

test("spendableFrom with no stakes is the headline purse", () => {
  assert.equal(spendableFrom(100, 0), 100);
});
