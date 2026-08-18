import assert from "node:assert/strict";
import { test } from "node:test";
import { winProbability } from "./win-probability.ts";

function outlook(id, mean, sd) {
  return { playerId: id, team: null, position: null, mean, sd, game: null };
}

test("equal projections → ~50", () => {
  const starters = [[outlook("a1", 12, 4)], [outlook("b1", 12, 4)]];
  const r = winProbability({ scores: [0, 0], starters });
  assert.ok(Math.abs(r.probability - 0.5) < 0.02, `got ${r.probability}`);
});

test("large home edge → homePct > 70", () => {
  const starters = [[outlook("a1", 20, 3)], [outlook("b1", 8, 3)]];
  const r = winProbability({ scores: [0, 0], starters });
  assert.ok(r.probability > 0.7, `got ${r.probability}`);
});
