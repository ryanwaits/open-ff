import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tradeDelta } from "../src/lib/league/lineup-value.ts";
import { readTrade } from "../src/lib/league/trade-read.ts";

/** Minimal RosterPlayer for pure read tests. */
function rp(id, position, extras = {}) {
  return {
    player_id: id,
    full_name: extras.full_name ?? id,
    last_name: extras.last_name,
    position,
    team: extras.team ?? "XX",
    slot: extras.slot ?? "bench",
    weekPts: null,
    injury_status: extras.injury_status ?? null,
    ...extras,
  };
}

function proj(map) {
  /** @type {Record<string, { points: number; reason: null }>} */
  const out = {};
  for (const [id, points] of Object.entries(map)) {
    out[id] = { points, reason: null };
  }
  return out;
}

const BANNED = /\b(win|lose|great|bad|should)\b/i;

describe("trade-read", () => {
  it("neutral trade: only no change to your starters", () => {
    const rosterPositions = ["QB", "WR"];
    const players = [
      rp("qb1", "QB", { full_name: "Alpha QB", last_name: "Alpha", slot: "starter" }),
      rp("wr1", "WR", { full_name: "Beta WR", last_name: "Beta", slot: "starter" }),
      rp("wr_bench", "WR", { full_name: "Gamma WR", last_name: "Gamma", slot: "bench" }),
    ];
    const projections = proj({ qb1: 20, wr1: 15, wr_bench: 8 });
    const delta = tradeDelta({
      players,
      rosterPositions,
      projections,
      outgoingIds: ["wr_bench"],
      incoming: [],
    });

    const line = readTrade({ delta, incoming: [], outgoing: [players[2]] });
    assert.match(line, /no change to your starters/i);
    assert.equal(line.replace(/\.$/, ""), "no change to your starters");
  });

  it("one upgrade names slot and gain", () => {
    // Keep RB1 locked so Cook lands on RB2 — the named upgrade is the slot's `to`.
    const rosterPositions = ["RB", "RB", "BN"];
    const players = [
      rp("rb1", "RB", { full_name: "Top Back", last_name: "Top", slot: "starter" }),
      rp("rb2", "RB", { full_name: "Old Back", last_name: "Back", slot: "starter" }),
    ];
    const cook = rp("cook", "RB", {
      full_name: "James Cook",
      last_name: "Cook",
      team: "BUF",
    });
    const projections = proj({ rb1: 20, rb2: 10, cook: 11.8 });
    const delta = tradeDelta({
      players,
      rosterPositions,
      projections,
      outgoingIds: [],
      incoming: [cook],
    });

    const line = readTrade({ delta, incoming: [cook], outgoing: [] });
    assert.match(line, /Cook upgrades RB2 by 1\.8/);
    assert.match(line, /\+1\.8 a week to your starters/);
  });

  it("one downgrade names the covering player", () => {
    const rosterPositions = ["QB", "BN"];
    const players = [
      rp("dak", "QB", {
        full_name: "Dak Prescott",
        last_name: "Prescott",
        slot: "starter",
      }),
      rp("backup", "QB", {
        full_name: "Backup QB",
        last_name: "Backup",
        slot: "bench",
      }),
    ];
    // Trade away the starter; backup covers at a cost.
    // Wait — "Prescott has to cover" means Prescott IS the cover (to), not the one leaving.
    // So: leave with a worse QB covering — trade elite QB, Prescott (worse) covers.
    const elite = rp("elite", "QB", {
      full_name: "Elite QB",
      last_name: "Elite",
      slot: "starter",
    });
    const prescott = rp("dak", "QB", {
      full_name: "Dak Prescott",
      last_name: "Prescott",
      slot: "bench",
    });
    const roster = [elite, prescott];
    const projections = proj({ elite: 22, dak: 14.1 });
    const delta = tradeDelta({
      players: roster,
      rosterPositions,
      projections,
      outgoingIds: ["elite"],
      incoming: [],
    });

    const line = readTrade({ delta, incoming: [], outgoing: [elite] });
    assert.match(line, /Prescott has to cover QB, which costs 7\.9/);
  });

  it("empty slot says left empty, not undefined", () => {
    const rosterPositions = ["QB", "TE"];
    const players = [
      rp("qb1", "QB", { full_name: "Starter QB", last_name: "Starter", slot: "starter" }),
      rp("te1", "TE", { full_name: "Lone TE", last_name: "Lone", slot: "starter" }),
    ];
    const projections = proj({ qb1: 20, te1: 10 });
    const delta = tradeDelta({
      players,
      rosterPositions,
      projections,
      outgoingIds: ["te1"],
      incoming: [],
    });

    const line = readTrade({ delta, incoming: [], outgoing: [players[1]] });
    assert.match(line, /TE is left empty/);
    assert.doesNotMatch(line, /undefined/i);
  });

  it("bye caveat within 3 weeks; not at 8 weeks", () => {
    const rosterPositions = ["RB", "BN"];
    const players = [
      rp("rb1", "RB", { full_name: "Start RB", last_name: "Start", slot: "starter" }),
    ];
    const etienne = rp("etn", "RB", {
      full_name: "Travis Etienne",
      last_name: "Etienne",
      team: "JAC",
    });
    const projections = proj({ rb1: 12, etn: 11 });

    // Bench-for-bench-ish: swap similar RBs so change may be small; force via delta
    // by trading nothing out and adding Etienne who doesn't start over rb1.
    const deltaNear = tradeDelta({
      players,
      rosterPositions,
      projections,
      outgoingIds: [],
      incoming: [etienne],
    });
    const near = readTrade({
      delta: deltaNear,
      incoming: [etienne],
      outgoing: [],
      byes: { JAC: 10 },
      week: 7,
    });
    assert.match(near, /Etienne is on a bye in week 10/);

    const far = readTrade({
      delta: deltaNear,
      incoming: [etienne],
      outgoing: [],
      byes: { JAC: 15 },
      week: 7,
    });
    assert.doesNotMatch(far, /bye/i);
  });

  it("never contains win/lose/great/bad/should", () => {
    const rosterPositions = ["QB", "RB", "WR", "TE"];
    const players = [
      rp("qb1", "QB", { full_name: "Q One", last_name: "One", slot: "starter" }),
      rp("rb1", "RB", { full_name: "R One", last_name: "One", slot: "starter" }),
      rp("wr1", "WR", { full_name: "W One", last_name: "One", slot: "starter" }),
      rp("te1", "TE", { full_name: "T One", last_name: "One", slot: "starter" }),
    ];
    const incoming = [
      rp("rb2", "RB", {
        full_name: "James Cook",
        last_name: "Cook",
        team: "BUF",
        injury_status: "Questionable",
      }),
    ];
    const projections = proj({ qb1: 20, rb1: 10, wr1: 12, te1: 8, rb2: 18 });
    const delta = tradeDelta({
      players,
      rosterPositions,
      projections,
      outgoingIds: ["rb1"],
      incoming,
    });

    const line = readTrade({
      delta,
      incoming,
      outgoing: [players[1]],
      byes: { BUF: 9 },
      week: 8,
    });
    assert.doesNotMatch(line, BANNED);
  });
});
