import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { AGENT_TOOLS } from "./catalog.ts";

const here = import.meta.dirname;
const root = join(here, "../../..");

function fnExports(rel) {
  const src = readFileSync(join(root, rel), "utf8");
  return [...src.matchAll(/^export const (\w+) = createServerFn/gm)].map((m) => m[1]);
}

function markdownIds() {
  const md = readFileSync(join(here, "CATALOG.md"), "utf8");
  return [
    ...md.matchAll(/^\| (\w+) \| (spectator|manager|commish) \| (atomic|workflow|read) \|/gm),
  ].map((m) => m[1]);
}

test("catalog ids === markdown ids === fns exports", () => {
  // Personal tokens must not be MCP tools — exclude *AgentToken(s) from both sides.
  const notToken = (id) => !/AgentTokens?$/.test(id);
  const fromFns = [
    ...fnExports("src/lib/league/fns.ts"),
    ...fnExports("src/lib/data/fns.ts"),
  ].filter(notToken);
  const fromCatalog = AGENT_TOOLS.map((t) => t.id).filter(notToken);
  const fromMd = markdownIds().filter(notToken);

  assert.deepEqual([...fromCatalog].sort(), [...fromFns].sort());
  assert.deepEqual([...fromMd].sort(), [...fromFns].sort());
  assert.equal(new Set(fromCatalog).size, fromCatalog.length);
});

test("dropPlayer, atomics, workflows, and the two new reads are classified", () => {
  const byId = Object.fromEntries(AGENT_TOOLS.map((t) => [t.id, t]));

  for (const id of [
    "makePick",
    "startPlayer",
    "sitPlayer",
    "queueAdd",
    "placeWager",
    "pullWager",
    "voteTrade",
    "cancelClaim",
    "setAutodraft",
    "dropPlayer",
  ]) {
    assert.equal(byId[id]?.kind, "atomic", id);
    assert.equal(byId[id]?.mutating, true, id);
  }

  for (const id of ["createLeague", "addDrop", "saveSettings", "advanceWeek", "autoFillDraft"]) {
    assert.equal(byId[id]?.kind, "workflow", id);
    assert.equal(byId[id]?.mutating, true, id);
  }

  for (const id of ["getEvents", "getLeagueFacts", "getBook", "getActivity"]) {
    assert.equal(byId[id]?.kind, "read", id);
    assert.equal(byId[id]?.mutating, false, id);
  }
});

test("tickAllLeagues is not a tool", () => {
  assert.ok(!AGENT_TOOLS.some((t) => t.id === "tick" || t.id === "tickAllLeagues"));
  const md = readFileSync(join(here, "CATALOG.md"), "utf8");
  assert.doesNotMatch(md, /^\| tickAllLeagues \|/m);
});

test("previewEspn / importEspn never log swid/espnS2", () => {
  for (const id of ["previewEspn", "importEspn"]) {
    const t = AGENT_TOOLS.find((row) => row.id === id);
    assert.match(t.description, /never log swid\/espnS2/i);
    assert.match(t.description, /not for traces/i);
  }
});

test("CATALOG.md links the context prompt", () => {
  const md = readFileSync(join(here, "CATALOG.md"), "utf8");
  assert.match(md, /context-prompt\.md/);
});
