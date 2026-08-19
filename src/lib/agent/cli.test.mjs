import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "../../..");

test("--help prints getEvents and placeWager without a DB", () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const r = spawnSync("bun", ["scripts/ledger.mjs", "--help"], {
    cwd: root,
    encoding: "utf8",
    env,
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /getEvents/);
  assert.match(r.stdout, /placeWager/);
});

test("placeWager is listed but not dispatched from argv", () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const r = spawnSync("bun", ["scripts/ledger.mjs", "placeWager", "--league", "lg_x"], {
    cwd: root,
    encoding: "utf8",
    env,
  });
  assert.notEqual(r.status, 0);
  assert.match(`${r.stdout}\n${r.stderr}`, /mutating|not dispatched|not available/i);
});
