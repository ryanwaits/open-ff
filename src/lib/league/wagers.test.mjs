import assert from "node:assert/strict";
import { test } from "node:test";
import { payoutMultiplier } from "./wagers.ts";

test("payoutMultiplier(0.25) → 3", () => {
  assert.equal(payoutMultiplier(0.25), 3);
});

test("payoutMultiplier(0.75) → ~0.33", () => {
  assert.equal(payoutMultiplier(0.75), 0.33);
});

test("payoutMultiplier(0.01) equals payoutMultiplier(0.05) (clamp)", () => {
  assert.equal(payoutMultiplier(0.01), payoutMultiplier(0.05));
});

test("payoutMultiplier(0.99) equals payoutMultiplier(0.95) (clamp)", () => {
  assert.equal(payoutMultiplier(0.99), payoutMultiplier(0.95));
});
