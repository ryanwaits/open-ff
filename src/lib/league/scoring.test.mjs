import assert from "node:assert/strict";
import { test } from "node:test";
import { applyBook, bookFromPreset } from "./scoring.ts";

const line = { rec: 10, rec_yd: 100, rec_td: 1 };

test("PPR: 10 rec, 100 rec yd, 1 rec TD → 26", () => {
  assert.equal(applyBook(bookFromPreset("ppr"), line), 26);
});

test("Half-PPR: same line → 21", () => {
  assert.equal(applyBook(bookFromPreset("half"), line), 21);
});

test("DST bucket: pts_allow 0 scores only pts_allow_0", () => {
  const book = bookFromPreset("ppr");
  assert.equal(applyBook(book, { pts_allow: 0 }), book.pts_allow_0);
});
