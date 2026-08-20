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
  assert.match(r.stdout, /getAgentContext/);
  assert.match(r.stdout, /placeWager/);
  assert.match(r.stdout, /--write/);
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

test("placeWager --write without --user/--stake fails without a DB", () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const r = spawnSync("bun", ["scripts/ledger.mjs", "placeWager", "--write", "--league", "lg_x"], {
    cwd: root,
    encoding: "utf8",
    env,
  });
  assert.notEqual(r.status, 0);
  const out = `${r.stdout}\n${r.stderr}`;
  assert.match(out, /--user|--stake/);
  assert.doesNotMatch(out, /import\.meta\.glob|PGLite bootstrap/i);
});

test("getAgentContext without --user fails without a DB", () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const r = spawnSync("bun", ["scripts/ledger.mjs", "getAgentContext", "--league", "lg_x"], {
    cwd: root,
    encoding: "utf8",
    env,
  });
  assert.notEqual(r.status, 0);
  assert.match(`${r.stdout}\n${r.stderr}`, /--user/);
});
