# Plan 023: Close the public clock, invite leak, and bid leak

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8816706..HEAD -- src/routes/api/league/tick.ts src/lib/league/fns.ts src/lib/league/engine.server.ts src/lib/league/ops.server.ts src/lib/data/fns.ts vercel.json`
> On a mismatch with the excerpts below, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none (pairs with 025 for documenting `CRON_SECRET`)
- **Category**: security
- **Planned at**: commit `8816706`, 2026-08-18
  (reconciled: tick.ts / vercel.json unchanged; invite still always
  returned at `engine.server.ts:532` and `:1960`; `listClaims` still
  leaks bids at `ops.server.ts:485-495`. `ClaimBanner` already types
  `inviteCode: string | null`.)

## Why this matters

Before any MCP/CLI/agent can sit in front of these primitives, the current
HTTP surface must not be stronger than a signed-in manager. Today:

1. Anyone who can hit `/api/league/tick` advances **every** unlocked league,
   processes waivers, and can lock the book.
2. `getLeagueBundle` and `getSettings` return the invite code to anyone who
   knows `leagueId`.
3. `getClaims` returns every pending bid, including signed-out callers.

An agent given only `leagueId` is already more privileged than the UI.

## Current state

```ts
// src/routes/api/league/tick.ts:3-17
GET/POST → ops.startLeagueClock(); ops.tickAllLeagues(); no secret
```

```ts
// src/lib/league/engine.server.ts:536
inviteCode: row.invite_code,  // always, in loadLeagueBundle
```

```ts
// src/lib/league/engine.server.ts:1930
invite_code,  // always, in loadSettings
```

```ts
// src/lib/league/ops.server.ts:449-451
.filter((r) => r.status === "pending" || r.roster_id === rosterId)
// pending rows keep `bid` for every roster
```

```json
// vercel.json
{ "crons": [{ "path": "/api/league/tick", "schedule": "15 * * * *" }] }
```

Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is
set in the project env. Honor that. In-process `startLeagueClock()`
(`ops.server.ts:1108-1115`) is a 5-minute loop started by the first tick —
keep it; it is not the public hole.

UI already hides the invite for non-commish (`src/routes/league/$leagueId.tsx`
around the invite line). Server must match.

## Commands you will need

| Purpose   | Command              | Expected |
|-----------|----------------------|----------|
| Typecheck | `bun run typecheck`  | exit 0   |
| Lint      | `bun run lint`       | exit 0   |
| Tests     | `bun test`           | pass     |

## Scope

**In scope**:
- `src/routes/api/league/tick.ts`
- `src/lib/league/engine.server.ts` — only the `inviteCode` field in
  `loadLeagueBundle` and `loadSettings`
- `src/lib/league/ops.server.ts` — only `listClaims` filter / bid redaction
- `src/lib/data/fns.ts` — only if `getLeagueBundle` needs a note; prefer
  changing the engine return
- `src/routes/league/$leagueId.tsx` / `settings.tsx` — only if they assume
  `inviteCode` is always a string (keep type `string | null`)
- A tiny test: `scripts/tick-auth.test.mjs` or `src/routes/api/league/tick.test.mjs`
  that reads the tick route source and asserts a `CRON_SECRET` / bearer check
  exists (source-string test, same style as `scripts/query-persist.test.mjs`)

**Out of scope**:
- Making all league reads membership-gated (product is still "secret URL desk")
- `claimRoster` invite requirement (follow-up; do not expand)
- ESPN GET cookies (follow-up)
- `joinLeague` CAS (`WHERE owner_id IS NULL`)
- Changing cron schedule
- `startup.sh` (025 will document how sandbox/self-host send the secret)

## Git workflow

- Commit: `fix: require a secret to tick leagues and stop leaking invites`
- Do NOT push

## Steps

### Step 1: Gate tick

In `src/routes/api/league/tick.ts`, before calling `tickAllLeagues`:

- Read `process.env.CRON_SECRET`. If **set** (non-empty after trim), require
  `Authorization: Bearer <that value>` **or** `?secret=<that value>` (query
  is for `curl` / compose; prefer the header).
- If **unset**, keep current behavior (Grok preview / local demo) and
  `console.warn` once that the clock is public.
- On mismatch: `401` JSON `{ error: "unauthorized" }`.

Do not invent a second secret name.

**Verify**: `rg -n "CRON_SECRET" src/routes/api/league/tick.ts` → at least one hit.

### Step 2: Invite only for commish

`loadLeagueBundle` and `loadSettings`:

```ts
inviteCode: userId && row.commish_id === userId ? row.invite_code : null,
```

Update return types to `string | null`. Grep callers:

```
rg -n "inviteCode" src
```

Non-commish UI already conditional. If any client does `inviteCode.toUpperCase()`
unguarded, use `inviteCode ?? ""` or skip the block.

**Verify**: `rg -n "inviteCode" src` — no unguarded string method on a value that
can now be null. `bun run typecheck` exits 0.

### Step 3: Redact foreign pending bids

In `listClaims`, after the existing filter:

- If `r.status === "pending"` and `r.roster_id !== rosterId`, return the row
  **without** `bid` (set `bid: null`) or drop the row entirely.

Prefer **dropping** other managers' pending rows (bids stay secret). The
current filter's intent was "show the wire that claims exist" — if the UI
needs a count, return `pendingCount` as a number and omit others' items.

Check `src/routes/league/$leagueId/wire.tsx` and roster claim lists before
choosing drop vs redact. If the UI lists every pending claim by player, keep
the row but `bid: null` unless `mine`.

**Verify**: `rg -n "listClaims|getClaims" src` — UI still typechecks.

### Step 4: Source-string test

Add `scripts/tick-auth.test.mjs` modeled on `scripts/query-persist.test.mjs`:
read `src/routes/api/league/tick.ts` as text, assert it mentions `CRON_SECRET`
and a 401 path.

**Verify**: `bun test scripts/tick-auth.test.mjs` → pass.

## Test plan

- Source-string test only (no HTTP server in this plan).
- Manual (not required): `CRON_SECRET=x curl -sf http://127.0.0.1:8080/api/league/tick` → 401.

## Done criteria

- [ ] Tick is 401 when `CRON_SECRET` is set and the request lacks it
- [ ] Tick still works when `CRON_SECRET` is unset (preview)
- [ ] `inviteCode` is null unless `userId === commish_id`
- [ ] Foreign pending bids are not returned as numbers
- [ ] `bun run typecheck` and `bun test` pass
- [ ] `plans/README.md` updated

## STOP conditions

- Vercel cron in this repo is configured to a different header than
  `Authorization: Bearer $CRON_SECRET` and you cannot confirm — implement
  bearer + query `secret`, document both, do not guess a third
- Hiding `inviteCode` breaks the join toast on `/new` (that path uses the
  **create** return value, not `loadLeagueBundle` — do not "fix" create)
- `listClaims` UI cannot render without every bid — stop and report rather
  than inventing a public bid board

## Maintenance notes

- 025 must tell self-hosters to set `CRON_SECRET` and pass it from compose/cron.
- Agent tools (024) must **never** wrap `tickAllLeagues`. Commish may get
  `tickLeague(leagueId)` later; not this URL.
- Reviewer: do not let the executor "also" membership-gate `getDesk`.
