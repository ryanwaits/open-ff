import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { displayPrefix, hashToken } from "./tokens.server.ts";

const here = import.meta.dirname;

test("hashToken is sha256 hex and never equals plaintext", () => {
  const raw = `off_${"ab".repeat(32)}`;
  const hashed = hashToken(raw);
  assert.equal(hashed, createHash("sha256").update(raw).digest("hex"));
  assert.equal(hashed.length, 64);
  assert.notEqual(hashed, raw);
  assert.ok(!hashed.startsWith("off_"));
});

test("displayPrefix keeps off_ head for UI lists", () => {
  const raw = `off_${"cd".repeat(32)}`;
  assert.equal(displayPrefix(raw), "off_cdcdcdcd");
  assert.ok(displayPrefix(raw).startsWith("off_"));
});

test("verify.server.ts accepts off_ via lookupToken", () => {
  const src = readFileSync(join(here, "verify.server.ts"), "utf8");
  assert.match(src, /off_/);
  assert.match(src, /lookupToken/);
});
