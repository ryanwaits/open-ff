import assert from "node:assert/strict";
import { test } from "node:test";
import { emailAllowed, normEmail } from "./allowlist.ts";

test("empty allowlist allows anyone (code-only)", () => {
  assert.equal(emailAllowed([], "ryan@x.com"), true);
  assert.equal(emailAllowed([], null), true);
});

test("normEmail trims and lowercases", () => {
  assert.equal(normEmail("  Ryan@X.com "), "ryan@x.com");
});

test("nonempty allowlist matches normalized email", () => {
  assert.equal(emailAllowed(["ryan@x.com"], "  Ryan@X.com "), true);
  assert.equal(emailAllowed(["ryan@x.com"], "other@x.com"), false);
});

test("nonempty allowlist denies missing email", () => {
  assert.equal(emailAllowed(["ryan@x.com"], null), false);
});
