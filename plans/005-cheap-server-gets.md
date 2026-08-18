# Plan 005: Cheap GETs — no tick-on-read, no extra bundle

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9948a37..HEAD -- src/lib/data/fns.ts src/lib/league/fns.ts src/lib/league/engine.server.ts src/lib/league/ops.server.ts src/lib/data/live.server.ts src/lib/data/player-profile.server.ts src/lib/data/projections.server.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. Known drift vs original `1abb347`
> (already reconciled — do **not** STOP for these):
> - `engine.server.ts` is `// @ts-nocheck` and grew (wagers/events). The tick
>   default is still `opts?.tick !== false` at `loadLeagueBundle` ~497.
>   Flip that default; do not reformat the file.
> - `ops.server.ts` grew (wagers). Do not rewrite `tickLeague`. Clock is
>   `startLeagueClock` ~1048. Internal bundle load already uses `{ tick: false }`.
> - `getClaims` still loads the full bundle (`fns.ts` ~303).
> - `ff_rosters.owner_id` is still the auth user column (`migrations/0002_leagues.sql`).

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (safe in parallel with 001–002; nicer after 003 so loaders are not amplifying expensive GETs)
- **Category**: perf
- **Planned at**: commit `9948a37`, 2026-08-17 (reconciled; tick-on-GET still present)
- **Landed**: `deab224` on `main` (not pushed; step 4 skipped)

## Why this matters

The league header polls `getLeagueBundle` every 15s when `scoringLive`. That GET, for hosted leagues, calls `tickLeague` (writes, waiver processing, week advance) plus `weekBoard`. `getMatchups` / `getTeam` / `getClaims` / recap / profile each rebuild overlapping slices (`getLeague` + rosters + `weekBoard` again). One tab click becomes several full-week rebuilds. Reads must be reads. The clock already ticks on an interval.

## Current state

Hosted bundle GET ticks by default (`src/lib/league/engine.server.ts:484-489`):

```ts
export async function loadLeagueBundle(leagueId: string, userId: string | null, opts?: { tick?: boolean }): Promise<LeagueBundle> {
	await ensureDemo();
	let row = await getLeague(leagueId);
	if (opts?.tick !== false && row.locked !== 1 && row.status !== "pre_draft" && row.status !== "drafting") try {
		await (await import("./ops.server")).tickLeague(leagueId);
		row = await getLeague(leagueId);
	} catch {}
```

The HTTP wrapper never passes `opts` (`src/lib/data/fns.ts:109-116`):

```ts
.handler(async ({ data, context }) => {
  if (isHostedLeague(data.leagueId)) {
    const eng = await import("@/lib/league/engine.server");
    return eng.loadLeagueBundle(data.leagueId, context.userId);
  }
```

`tick: false` already exists and is used internally (`src/lib/league/ops.server.ts:678`).

The clock is independent of GET (`ops.server.ts:827-834`): `startLeagueClock()` sets a 5-minute interval + a 20s first run. `ensureDemo()` (`engine.server.ts:236-237`) starts that clock. `/api/league/tick` also starts it and runs `tickAllLeagues`. **Do not remove the clock.**

`getClaims` (`src/lib/league/fns.ts:293-300`) loads the *full* bundle just to pass `bundle.myRosterId` into `listClaims(leagueId, rosterId)` (`ops.server.ts:344`). `listClaims` only uses that id to mark `mine`.

`weekBoard` (`src/lib/data/live.server.ts:86-98`) calls `espn.fetchScoreboard` every time. ESPN already has a 12s `eget` cache (`espn.server.ts:38-47`), so the extra cost is the wrapper + Map rebuild. Still: bundle + matchups + team each call it. Add an in-process `weekBoard` memo so one request storm shares one result.

`getWeekStats` (`fns.ts:38-48`) returns Sleeper’s entire player→stats dictionary. Matchups + box score pull it to seed replay. Trimming to roster ids is a stretch goal in this plan (step 4), not required if time runs out — do not block 1–3 on it.

`getPlayerProfile` / projections also call `loadLeagueBundle` (`player-profile.server.ts:53`, `projections.server.ts:47`) — pass `{ tick: false }` if they go through the hosted path.

Convention: server fns live in `src/lib/data/fns.ts` and `src/lib/league/fns.ts`. Engine stays in `engine.server.ts`. Do not move files.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `npm run typecheck` | exit 0              |
| Tests     | `npm test`          | all pass            |

No new packages.

## Scope

**In scope**:
- `src/lib/data/fns.ts` — hosted `getLeagueBundle` passes `{ tick: false }`
- `src/lib/league/fns.ts` — `getClaims` does not call `loadLeagueBundle`
- `src/lib/league/engine.server.ts` — only if you add a tiny `rosterIdForUser` helper or change the **default** of `tick` to false (preferred: change the default so every accidental caller is safe)
- `src/lib/data/player-profile.server.ts` — pass `{ tick: false }`
- `src/lib/data/projections.server.ts` — pass `{ tick: false }`
- `src/lib/data/live.server.ts` — in-process memo for `weekBoard`
- `src/lib/data/fns.ts` `getWeekStats` — **optional** `playerIds?: string[]` trim (step 4)

**Out of scope**:
- Rewriting `tickLeague` / waiver logic
- Removing `startLeagueClock` or `/api/league/tick`
- Combining `loadMatchups` + `loadTeam` into one document loader
- Client poll changes
- Recap `Promise.all(loadLeagueBundle, loadMatchups, loadActivity)` rewrite (mention only; do not do it unless it is a 10-line change to pass `{ tick: false }`)

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `perf: stop ticking hosted leagues on read`

## Steps

### Step 1: GET bundle does not tick

Two layers, both required:

1. Change the **default** on `loadLeagueBundle` so omitting `opts` means no tick:

```ts
export async function loadLeagueBundle(
  leagueId: string,
  userId: string | null,
  opts?: { tick?: boolean },
): Promise<LeagueBundle> {
  await ensureDemo();
  let row = await getLeague(leagueId);
  if (opts?.tick === true && row.locked !== 1 && row.status !== "pre_draft" && row.status !== "drafting") {
    try {
      await (await import("./ops.server")).tickLeague(leagueId);
      row = await getLeague(leagueId);
    } catch {}
  }
  // …rest unchanged
}
```

Today `tick !== false` means “tick unless told not to”. Flip to `tick === true` (opt-in). Grep every `loadLeagueBundle(` call. The only caller that should pass `{ tick: true }` is a **write-adjacent** path if you find one. Clock / `tickLeague` / `tickAllLeagues` stay the writers.

2. Hosted `getLeagueBundle` in `fns.ts` stays a thin wrapper (no tick).

**Verify**: `rg -n "loadLeagueBundle\\(" src` — every call either passes `{ tick: true }` deliberately or relies on the new default (no tick). `rg -n "tick !== false" src/lib/league/engine.server.ts` → no matches.

### Step 2: `getClaims` does not load the bundle

`src/lib/league/fns.ts` `getClaims` handler today:

```ts
const bundle = await eng.loadLeagueBundle(data.leagueId, context.userId);
return ops.listClaims(data.leagueId, bundle.myRosterId);
```

Replace with a cheap roster lookup. Preferred: add `rosterIdOwnedBy(leagueId, userId)` next to `getRosters` in `engine.server.ts`:

```ts
export async function rosterIdOwnedBy(
  leagueId: string,
  userId: string | null,
): Promise<number | null> {
  if (!userId) return null;
  const sql = await getSql();
  const rows = await sql<{ roster_id: number }>`
    select roster_id from ff_rosters
    where league_id = ${leagueId} and owner_id = ${userId}
    limit 1
  `;
  return rows[0]?.roster_id ?? null;
}
```

Then:

```ts
const mine = await eng.rosterIdOwnedBy(data.leagueId, context.userId ?? null);
return ops.listClaims(data.leagueId, mine);
```

Do not call `ensureDemo` / `weekBoard` / standings.

**Verify**: `rg -n "getClaims" -A 12 src/lib/league/fns.ts` shows no `loadLeagueBundle`. `npm run typecheck` exits 0.

### Step 3: Memo `weekBoard`

In `src/lib/data/live.server.ts`, wrap `weekBoard` with the same 12s Map pattern already used for `pointsCache` / `statsCache` in that file (`:42-75`):

```ts
const boardCache = new Map<string, { at: number; data: Awaited<ReturnType<typeof weekBoardUncached>> }>();

export async function weekBoard(season: string, week: number, seasonType?: string | null) {
  const key = `${season}:${week}:${seasonType ?? ""}`;
  const hit = boardCache.get(key);
  if (hit && Date.now() - hit.at < 12_000) return hit.data;
  const data = await weekBoardUncached(season, week, seasonType);
  boardCache.set(key, { at: Date.now(), data });
  return data;
}
```

Rename the current body to `weekBoardUncached` (not exported). Keep the 12s TTL aligned with `fetchScoreboard`’s `eget` TTL — do not invent a longer live TTL.

**Verify**: `rg -n "boardCache" src/lib/data/live.server.ts` → set + get. Typecheck clean.

### Step 4 (optional, do not block the commit): slim `getWeekStats`

If steps 1–3 are done and typecheck is green, add an optional `playerIds: z.array(z.string()).optional()` to `getWeekStats`. When present, return only those keys from the Sleeper dict. Update matchups + box score to pass the starter/bench ids they already have **only if** that does not create a new waterfall (they must already know the ids from `matchups.data`). If they do not, **skip this step**.

**Verify** (if done): validator accepts `playerIds`; callers that pass it still typecheck. If skipped, write `skipped step 4` in the README status note — still mark 005 DONE.

## Test plan

- No new test runner. `npm test` stays green.
- There is no existing engine unit test. Do not stand up a DB test harness in this plan.
- Manual if a league exists: open a hosted league Home on a live NFL Sunday (or with `scoringLive`). Network tab: `getLeagueBundle` must not be followed by waiver/write errors; week does not randomly jump. Clock still exists (`startLeagueClock` still referenced from `ensureDemo`).

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0
- [ ] `loadLeagueBundle` ticks only when `opts.tick === true`
- [ ] `getClaims` does not call `loadLeagueBundle`
- [ ] `weekBoard` has a 12s in-process cache
- [ ] `startLeagueClock` / `/api/league/tick` / `tickLeague` still exist and are called from the clock
- [ ] No files outside the in-scope list
- [ ] `plans/README.md` 005 → DONE (note if step 4 skipped)

## STOP conditions

- Flipping the tick default would skip a caller that **only** ticked via GET and never via the clock (you find a production path that needs tick-on-read). Report the caller; do not delete `tickLeague`. Safer fallback: leave the default as-is and only pass `{ tick: false }` from `fns.ts` `getLeagueBundle` + profile + projections.
- `ff_rosters.owner_id` is not the auth user id (column renamed). Read the table in `migrations/` and use the real column. Do not guess.
- Memoizing `weekBoard` would require changing its return type (Map vs JSON). Keep returning the same `{ live, index, games }` object. `index` is a `Map` — that is already the contract with `loadMatchups`. Do not serialize it.
- A verification command fails twice.

## Maintenance notes

- New hosted GET server fns must not call `loadLeagueBundle` without `{ tick: false }` (redundant after the default flip, still do not pass `tick: true`).
- If waivers seem “stuck” after this ships, the clock is the place to look (`startLeagueClock` 5 min + `/api/league/tick`), not the bundle GET.
- Reviewer: confirm no client was relying on “opening the desk advances the week.” That coupling is the bug.
- Follow-up: request-scoped dataloader for `getLeague` + `getRosters` + `scoreWeekMap` so `loadMatchups` / `loadTeam` share one read. Not this plan.
