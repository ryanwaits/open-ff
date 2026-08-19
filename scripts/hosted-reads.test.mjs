import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");

/** Slice one `export const name = createServerFn…` through the next export. */
function handlerSrc(fileSrc, name) {
  const start = fileSrc.indexOf(`export const ${name} = createServerFn`);
  assert.ok(start >= 0, `${name} not found`);
  const next = fileSrc.indexOf("\nexport const ", start + 1);
  return next < 0 ? fileSrc.slice(start) : fileSrc.slice(start, next);
}

test("hosted league GETs require assertLeagueViewer; previewInvite stays public", () => {
  const dataFns = readFileSync(join(root, "src/lib/data/fns.ts"), "utf8");
  const leagueFns = readFileSync(join(root, "src/lib/league/fns.ts"), "utf8");

  for (const name of [
    "getMatchups",
    "getTeam",
    "getWire",
    "getActivity",
    "getWeekProjections",
    "getRecap",
  ]) {
    const src = handlerSrc(dataFns, name);
    assert.match(src, /assertLeagueViewer/, `${name} must call assertLeagueViewer`);
  }

  for (const name of ["getMockPool", "getTradablePicks"]) {
    const src = handlerSrc(leagueFns, name);
    assert.match(src, /assertLeagueViewer/, `${name} must call assertLeagueViewer`);
  }

  const preview = handlerSrc(leagueFns, "previewInvite");
  assert.doesNotMatch(preview, /assertLeagueViewer/, "previewInvite must stay ungated");
});
