import assert from "node:assert/strict";
import { test } from "node:test";
import { AGENT_TOOLS } from "./catalog.ts";
import { AGENT_CORE } from "./core.ts";
import { dispatch } from "./dispatch.ts";

test("AGENT_CORE ⊆ AGENT_TOOLS and excludes tick", () => {
  const catalogIds = new Set(AGENT_TOOLS.map((t) => t.id));
  for (const id of AGENT_CORE) {
    assert.ok(catalogIds.has(id), `${id} missing from AGENT_TOOLS`);
    assert.notEqual(id, "tick");
    assert.notEqual(id, "tickAllLeagues");
  }
  assert.ok(!AGENT_CORE.has("tick"));
  assert.ok(!AGENT_CORE.has("tickAllLeagues"));
});

test("unknown id throws", async () => {
  await assert.rejects(() => dispatch("notARealTool", "user_x", {}), /Unknown tool/);
});

test("tick / tickAllLeagues refused", async () => {
  await assert.rejects(() => dispatch("tick", "user_x", {}), /cron clock|not a tool/);
  await assert.rejects(() => dispatch("tickAllLeagues", "user_x", {}), /cron clock|not a tool/);
});

test("mutating without userId refused", async () => {
  await assert.rejects(
    () => dispatch("sitPlayer", null, { leagueId: "lg_x", playerId: "p1" }),
    /OPENFF_USER|signed-in/,
  );
  await assert.rejects(
    () => dispatch("placeWager", undefined, { leagueId: "lg_x" }),
    /OPENFF_USER|signed-in/,
  );
  await assert.rejects(
    () => dispatch("importLeague", null, { sleeperId: "123", confirm: true }),
    /OPENFF_USER|signed-in/,
  );
});

test("importLeague without confirm refused", async () => {
  await assert.rejects(() => dispatch("importLeague", "user_x", { sleeperId: "123" }), /confirm/);
});
