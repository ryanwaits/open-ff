import { test } from "bun:test";
import assert from "node:assert/strict";
import { projectionRosterKey } from "./projection-key";

test("same length, different ids, different key", () => {
  const before = projectionRosterKey(["a", "b", "c"]);
  const after = projectionRosterKey(["a", "b", "d"]);
  assert.notEqual(before, after);
});

test("order does not matter", () => {
  assert.equal(projectionRosterKey(["b", "a"]), projectionRosterKey(["a", "b"]));
});

test("empty is stable", () => {
  assert.equal(projectionRosterKey(undefined), "");
  assert.equal(projectionRosterKey([]), "");
});
