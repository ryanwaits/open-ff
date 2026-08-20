import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const src = readFileSync(join(import.meta.dirname, "../../../public/sw.js"), "utf8");

test("never intercepts /__grok/ with a cache", () => {
  assert.match(src, /\/__grok/);
  assert.match(src, /pathname\.startsWith\("\/__grok"\)/);
  assert.doesNotMatch(src, /\bcache\.(put|add|addAll)\b/);
});

test("does not precache the app shell", () => {
  assert.doesNotMatch(src, /\bcache\.addAll\b/);
  assert.doesNotMatch(src, /\bprecache\b/);
});

test("navigations use fetch( without a cached HTML fallback", () => {
  assert.match(src, /event\.request\.mode === "navigate"/);
  assert.match(src, /fetch\(event\.request\)/);
  assert.match(src, /network-only/);
  assert.doesNotMatch(src, /cache\.put\(\s*event\.request/);
});
