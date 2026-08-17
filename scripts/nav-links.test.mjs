import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");

test("shell league tabs are Links with intent preload, not raw <a>", () => {
  const shell = readFileSync(join(root, "src/components/shell.tsx"), "utf8");
  assert.doesNotMatch(shell, /tabs\.map\(\(t\) => \(\s*<a/);
  assert.match(shell, /preload=["']intent["']/);
});

test("router defaults to intent preload", () => {
  const router = readFileSync(join(root, "src/router.tsx"), "utf8");
  assert.match(router, /defaultPreload:\s*["']intent["']/);
});

test("home league rows are Links to /league/$leagueId", () => {
  const index = readFileSync(join(root, "src/routes/index.tsx"), "utf8");
  assert.match(index, /to=["']\/league\/\$leagueId["']/);
  assert.match(index, /preload=["']intent["']/);
});
