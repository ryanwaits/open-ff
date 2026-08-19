import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");

test("join login bounce preserves invite code in redirect", () => {
  const src = readFileSync(join(root, "src/routes/join.tsx"), "utf8");
  assert.doesNotMatch(src, /redirect:\s*["']\/join["']/, "bare /join redirect drops ?code=");
  const bounces = [
    ...src.matchAll(
      /redirect:\s*code\.trim\(\)\s*\?[\s\S]*?`\/join\?code=\$\{encodeURIComponent\(code\.trim\(\)\)\}`[\s\S]*?:\s*["']\/join["']/g,
    ),
  ];
  assert.equal(bounces.length, 2, "both Navigate and unauthorized navigate must keep code=");
  assert.match(src, /code=/);
});
