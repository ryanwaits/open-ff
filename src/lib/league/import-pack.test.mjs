import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mergeSleeperHistory,
  packFromEspn,
  packFromRebuild,
  packFromSleeper,
} from "./import-pack.ts";

const sleeperFixture = {
  league: {
    league_id: "lg_sleep_1",
    name: "Backyard Bowl",
    season: "2026",
    status: "in_season",
    roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN", "BN"],
    scoring_settings: { pass_td: 4, rec: 1, rush_td: 6 },
    previous_league_id: "lg_sleep_0",
    settings: {
      playoff_teams: 4,
      playoff_week_start: 15,
      leg: 3,
      last_scored_leg: 2,
    },
  },
  users: [
    { user_id: "u1", display_name: "Ada", metadata: { team_name: "Ada's Aces" } },
    { user_id: "u2", display_name: "Bea", metadata: {} },
  ],
  rosters: [
    {
      roster_id: 1,
      owner_id: "u1",
      players: ["4046", "4866", "0"],
      starters: ["4046", "4866"],
      settings: { wins: 1, losses: 1 },
    },
    {
      roster_id: 2,
      owner_id: "u2",
      players: ["6794"],
      starters: ["6794"],
      settings: { wins: 2, losses: 0 },
    },
  ],
  weeks: [
    {
      week: 1,
      rows: [
        {
          roster_id: 1,
          matchup_id: 1,
          points: 110.2,
          starters: ["4046"],
          starters_points: [22.1],
        },
        {
          roster_id: 2,
          matchup_id: 1,
          points: 98.4,
          starters: ["6794"],
          starters_points: [18.0],
        },
      ],
    },
  ],
};

test("packFromSleeper maps fixture to ImportPack shape", () => {
  const pack = packFromSleeper(sleeperFixture);
  assert.equal(pack.source, "sleeper");
  assert.equal(pack.sourceLeagueId, "lg_sleep_1");
  assert.equal(pack.name, "Backyard Bowl");
  assert.equal(pack.season, "2026");
  assert.equal(pack.status, "in_season");
  assert.equal(pack.playoffTeams, 4);
  assert.equal(pack.currentWeek, 3);
  assert.equal(pack.book.rec, 1);
  assert.equal(pack.book.pass_td, 4);
  assert.equal(pack.teams.length, 2);
  assert.equal(pack.teams[0].teamName, "Ada's Aces");
  assert.equal(pack.teams[0].manager, "Ada");
  assert.equal(pack.teams[0].ownerKey, "u1");
  assert.ok(pack.teams[0].players.every((p) => p.playerId !== "0"));
  assert.equal(pack.teams[0].players[0].starterSlot, "QB");
  assert.equal(pack.weeks.length, 1);
  assert.equal(pack.weeks[0].games[0].home, 1);
  assert.equal(pack.weeks[0].games[0].away, 2);
  assert.equal(pack.weeks[0].results[0].points, 110.2);
  assert.equal(pack.weeks[0].results[0].starters[0].playerId, "4046");
});

test("mergeSleeperHistory attaches prior snap without rewriting weeks", () => {
  const pack = packFromSleeper(sleeperFixture);
  const prior = {
    ...sleeperFixture,
    league: {
      ...sleeperFixture.league,
      league_id: "lg_sleep_0",
      name: "Backyard 2025",
      season: "2025",
    },
    rosters: [
      {
        roster_id: 1,
        owner_id: "u1",
        players: [],
        starters: [],
        settings: { wins: 9, losses: 5, ties: 0, fpts: 1400, fpts_decimal: 50 },
      },
      {
        roster_id: 2,
        owner_id: "u2",
        players: [],
        starters: [],
        settings: { wins: 8, losses: 6, fpts: 1300, fpts_decimal: 0 },
      },
    ],
    weeks: [],
  };
  const merged = mergeSleeperHistory(pack, prior);
  assert.equal(merged.weeks.length, pack.weeks.length);
  assert.equal(merged.teams[0].snap.wins, 9);
  assert.equal(merged.teams[0].snap.pf, 1400.5);
  assert.ok(merged.warnings?.some((w) => /prior season Backyard 2025/i.test(w)));
});

test("packFromEspn maps ESPN pack fields", () => {
  const pack = packFromEspn({
    leagueId: "12345",
    name: "ESPN Desk",
    season: "2026",
    status: "in_season",
    book: { pass_td: 4, rec: 0.5, rush_td: 6 },
    slots: ["QB", "RB", "WR", "TE", "FLEX", "BN"],
    playoffTeams: 6,
    currentWeek: 4,
    teams: [
      {
        rosterId: 1,
        teamName: "Tigers",
        manager: "Chris",
        ownerKey: "{GUID}",
        players: [{ sleeperId: "4046", slot: "starter", starterSlot: "QB" }],
      },
    ],
    weeks: [
      {
        week: 1,
        games: [{ matchupId: 1, home: 1, away: null }],
        results: [{ rosterId: 1, points: 100, starters: [{ playerId: "4046", points: 20 }] }],
      },
    ],
  });
  assert.equal(pack.source, "espn");
  assert.equal(pack.sourceLeagueId, "espn:2026:12345");
  assert.equal(pack.book.rec, 0.5);
  assert.equal(pack.teams[0].players[0].playerId, "4046");
  assert.equal(pack.teams[0].players[0].starterSlot, "QB");
  assert.equal(pack.weeks[0].results[0].starters[0].points, 20);
});

test("packFromRebuild uses preset scoring and snap records", () => {
  const pack = packFromRebuild({
    name: "Paste League",
    season: "2025",
    scoring: "half",
    knownId: "wiffl-2026",
    teams: [
      {
        teamName: "Alpha",
        manager: "A",
        wins: 10,
        losses: 4,
        ties: 0,
        pf: 1500,
        pa: 1400,
        names: ["Definitely Not A Real Player Name XYZ"],
      },
      {
        teamName: "Beta",
        manager: "B",
        wins: 8,
        losses: 6,
        ties: 0,
        pf: 1400,
        pa: 1450,
        names: [],
      },
    ],
  });
  assert.equal(pack.source, "rebuild");
  assert.equal(pack.sourceLeagueId, "wiffl-2026");
  assert.equal(pack.book.rec, 0.5);
  assert.equal(pack.synthesizeSchedule, false);
  assert.equal(pack.teams[0].snap.wins, 10);
  assert.equal(pack.teams.length, 2);
  assert.deepEqual(pack.weeks, []);
});

test("ImportPack required keys present on all adapters", () => {
  const keys = [
    "source",
    "sourceLeagueId",
    "name",
    "season",
    "status",
    "book",
    "slots",
    "playoffTeams",
    "currentWeek",
    "teams",
    "weeks",
  ];
  for (const pack of [
    packFromSleeper(sleeperFixture),
    packFromEspn({
      leagueId: "1",
      name: "E",
      season: "2026",
      status: "pre_draft",
      book: { rec: 1 },
      slots: ["QB", "BN"],
      playoffTeams: 4,
      currentWeek: 1,
      teams: [],
      weeks: [],
    }),
    packFromRebuild({
      name: "R",
      season: "2026",
      scoring: "ppr",
      teams: [
        {
          teamName: "A",
          manager: "a",
          wins: null,
          losses: null,
          ties: null,
          pf: null,
          pa: null,
          names: [],
        },
        {
          teamName: "B",
          manager: "b",
          wins: null,
          losses: null,
          ties: null,
          pf: null,
          pa: null,
          names: [],
        },
      ],
    }),
  ]) {
    for (const k of keys) assert.ok(k in pack, `missing ${k} on ${pack.source}`);
  }
});
