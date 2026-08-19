# Plan 030: Require a seat for every hosted league GET

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dd9bc53..HEAD -- src/lib/data/fns.ts src/lib/league/fns.ts src/lib/league/engine.server.ts`
> Compare excerpts if those files moved.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/028-invite-allowlist.md (DONE `fe3d1a6`)
- **Category**: security
- **Planned at**: commit `dd9bc53`, 2026-08-19

## Why this matters

028 closed the *page*. Every league route loads `getLeagueBundle` first, and
that now throws `UnauthorizedError` unless you are commish or own a seat.
The *RPCs* that fill the page were left public. Anyone who knows `lg_…`
can still call `getMatchups` / `getTeam` / `getActivity` / `getWire` (and
`getRecap` / `getWeekProjections` / `getTradablePicks` / `getMockPool`)
and read lineups, the wire, and the week recap. Invite-only is a lie until
those hosted branches call the same `assertLeagueViewer`.

Sleeper numeric-id leagues stay public on purpose — they are someone
else's already-public data.

## Current state

`assertLeagueViewer` (`engine.server.ts:276-286`): no `userId` →
`UnauthorizedError`; else commish **or** `ff_rosters.owner_id = userId`.

`isHostedLeague` (`src/lib/data/types.ts:420-422`): `id.startsWith("lg_")`.

Already gated (do not re-do): `getLeagueBundle`, `getDesk`, `getEvents`,
`getLeagueFacts`, `getDraft`, `getSettings`, `getClaims`, `getTrades`,
`getSchedule`, `getBook`.

Still open — `src/lib/data/fns.ts`:

```ts
// getMatchups:124-132 — no middleware, no viewer
if (isHostedLeague(data.leagueId)) {
  return eng.loadMatchups(data.leagueId, data.week);
}

// getTeam:143-154, getWire:171-174, getActivity:182-185,
// getWeekProjections:256-264, getRecap:327-329
// same pattern: hosted branch loads engine, never asserts
```

Still open — `src/lib/league/fns.ts`:

- `getMockPool` (111-114): optionalAuth, no viewer
- `getTradablePicks` (503-508): optionalAuth, no viewer

Exemplar — copy this exact shape from `getLeagueBundle` (111-118):

```ts
.middleware([optionalAuthMiddleware])
.handler(async ({ data, context }) => {
  if (isHostedLeague(data.leagueId)) {
    const eng = await import("@/lib/league/engine.server");
    await eng.assertLeagueViewer(data.leagueId, context.userId);
    return eng.loadMatchups(data.leagueId, data.week);
  }
  // sleeper path unchanged
});
```

`getTeam` / `getWire` / `getActivity` / `getRecap` / `getWeekProjections`
have **no** middleware today — add `optionalAuthMiddleware` so
`context.userId` exists. Do not switch them to hard `authMiddleware`
(unsigned Sleeper ids must still work).

`previewInvite` / `joinLeague` stay ungated.

## Commands you will need

| Purpose   | Command              | Expected |
|-----------|----------------------|----------|
| Typecheck | `bun run typecheck`  | exit 0   |
| Tests     | `bun test`           | pass     |
| Lint      | `bunx biome check` on files you edit | exit 0 |

## Scope

**In scope**:
- `src/lib/data/fns.ts` — hosted branch of `getMatchups`, `getTeam`,
  `getWire`, `getActivity`, `getWeekProjections`, `getRecap`
- `src/lib/league/fns.ts` — `getMockPool`, `getTradablePicks`
- `scripts/hosted-reads.test.mjs` (create) — source-string test that
  every hosted `isHostedLeague` / `loadMatchups|loadTeam|loadWire|
  loadActivity|loadDispatch|listTradablePicks` path in those two files
  is preceded (same handler) by `assertLeagueViewer`

**Out of scope**:
- Gating Sleeper numeric-id `getMatchups` / `getTeam` / etc.
- `getPulse`, `getScores`, `getByeWeeks`, `getLeaders`, `getPlayerSearch`
  (no league desk)
- `getProjections` / `getOutlooks` / `getPlayerProfile` (caller supplies
  player ids; do not invent a gate)
- Changing `assertLeagueViewer` itself
- Allowlist / join / claim (028)
- UI restyle

## Git workflow

- Branch: current
- Commit: `fix: require a seat to read hosted matchups and rosters`
- Do NOT push

## Steps

### Step 1: Gate data/fns hosted branches

Add `optionalAuthMiddleware` + `assertLeagueViewer` on the hosted branch
of `getMatchups`, `getTeam`, `getWire`, `getActivity`, `getWeekProjections`,
`getRecap`. Sleeper `else` / non-`lg_` path unchanged.

**Verify**: `rg -n "assertLeagueViewer" src/lib/data/fns.ts` hits all six.
`rg -n "export const getMatchups" -A 20 src/lib/data/fns.ts` still has a
sleeper `loadMatchups` call with no viewer.

### Step 2: Gate remaining league/fns reads

Same for `getMockPool` and `getTradablePicks` (they already have
optionalAuth). Call `assertLeagueViewer` before loading.

**Verify**: `rg -n "assertLeagueViewer" src/lib/league/fns.ts` includes
those two handlers. `previewInvite` still has none.

### Step 3: Source-string test

`scripts/hosted-reads.test.mjs` (pattern: `scripts/join-redirect.test.mjs`):

- Read `src/lib/data/fns.ts` and `src/lib/league/fns.ts`.
- For each of `getMatchups`, `getTeam`, `getWire`, `getActivity`,
  `getWeekProjections`, `getRecap`, `getMockPool`, `getTradablePicks`:
  the handler source contains `assertLeagueViewer`.
- `previewInvite` handler does **not**.

**Verify**: `bun test scripts/hosted-reads.test.mjs` passes.

## Test plan

- New source-string test as in step 3.
- Do not stand up a live PGLite session.

## Done criteria

- [ ] All eight hosted GETs call `assertLeagueViewer`
- [ ] Sleeper numeric-id paths still have no membership check
- [ ] `previewInvite` remains public
- [ ] `bun test` and `bun run typecheck` pass
- [ ] No files outside scope

## STOP conditions

- Gating a GET breaks a Sleeper-imported (non-`lg_`) walk — undo that
  one handler and report
- You think you need a "public desk" toggle — stop; do not add one
- `assertLeagueViewer` is missing or renamed — stop

## Maintenance notes

- New hosted GET with a `leagueId` must call `assertLeagueViewer` or the
  source-string test should be extended to include it.
- Reviewer: reject a gate on the Sleeper branch.
