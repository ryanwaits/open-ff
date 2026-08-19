import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");

function src(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("loaders warm cache instead of blocking on stale ensureQueryData", () => {
  const client = src("src/lib/query-client.ts");
  assert.match(client, /export function warmQuery/);
  assert.match(client, /localStorage\.getItem\(PERSIST_STORAGE_KEY\)/);
  assert.match(client, /hydrate\(client/);

  const league = src("src/routes/league/$leagueId.tsx");
  assert.match(league, /warmQuery\(/);
  assert.doesNotMatch(league, /ensureQueryData\(/);

  const scores = src("src/routes/scores.tsx");
  assert.match(scores, /warmQuery\(/);
  assert.doesNotMatch(scores, /ensureQueryData\(/);
});

test("league header and new sheets keep last-known instead of isLoading unmount", () => {
  const league = src("src/routes/league/$leagueId.tsx");
  assert.doesNotMatch(league, /\{q\.isLoading \?/);
  assert.match(league, /q\.data == null && q\.isPending/);

  for (const rel of [
    "src/routes/league/$leagueId/draft.tsx",
    "src/routes/league/$leagueId/settings.tsx",
    "src/routes/league/$leagueId/player/$playerId.tsx",
    "src/routes/scores_.$gameId.tsx",
    "src/components/schedule-desk.tsx",
  ]) {
    const file = src(rel);
    assert.doesNotMatch(file, /if \(q\.isLoading\)/, `${rel} still gates on q.isLoading`);
    assert.doesNotMatch(file, /if \(league\.isLoading\)/, `${rel} still gates on league.isLoading`);
  }

  const mock = src("src/routes/league/$leagueId/mock.tsx");
  assert.match(mock, /league\.data == null && league\.isPending/);
  assert.ok(
    mock.indexOf("league.data == null && league.isPending") < mock.indexOf("!league.data?.hosted"),
    "mock must not treat a pending bundle as a Sleeper peek",
  );
});

test("wire keeps previous rows and warms the list on intent", () => {
  const wire = src("src/routes/league/$leagueId/wire.tsx");
  assert.doesNotMatch(wire, /placeholderData:\s*undefined/);
  assert.match(wire, /warmQuery\(/);
  assert.match(wire, /prefetchPlayerProfile/);
});

test("player profiles prefetch on intent and paint identity from cache", () => {
  const view = src("src/lib/data/player-view.ts");
  assert.match(view, /export function prefetchPlayerProfile/);
  assert.match(view, /export function findCachedSlimPlayer/);
  assert.match(view, /export function useWarmRosterProfiles/);

  const page = src("src/routes/league/$leagueId/player/$playerId.tsx");
  assert.match(page, /prefetchQuery\(profileQueryOptions/);
  assert.match(page, /findCachedSlimPlayer/);
  assert.doesNotMatch(page, /if \(q\.isLoading\)/);

  const lineup = src("src/components/lineup-board.tsx");
  assert.match(lineup, /onIntentPlayer/);
  assert.match(lineup, /onPointerEnter/);
});

test("activity, recap, and team do not wait on the full bundle", () => {
  const activity = src("src/routes/league/$leagueId/activity.tsx");
  assert.doesNotMatch(activity, /enabled:\s*Boolean\(league\.data\)/);

  const recap = src("src/routes/league/$leagueId/recap.tsx");
  assert.doesNotMatch(recap, /enabled:\s*Boolean\(league\.data\)/);

  const team = src("src/routes/league/$leagueId/team/$rosterId.tsx");
  assert.doesNotMatch(team, /enabled:\s*Boolean\(league\.data\)/);
});
