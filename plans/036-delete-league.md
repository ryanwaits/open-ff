# Plan 036: Let a commish delete a league they run

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to
> the next step. If a STOP fires, report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat dd9bc53..HEAD -- src/lib/league/fns.ts src/lib/league/engine.server.ts src/routes/league/$leagueId/settings.tsx src/lib/agent/catalog.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: plans/034-league-backup.md (download first — or ship
  a "type the name" confirm if 034 is not done and you must proceed)
- **Category**: dx
- **Planned at**: commit `dd9bc53`, 2026-08-19

## Why this matters

There is no `deleteLeague`. A commish who created a throwaway (or the
wager-qa script's leftover desks) has no way to remove it. Seats,
FAAB, and the book sit forever. Self-host pickup without delete is a
roach motel. This is irreversible — confirm in the UI by typing the
league name, commish only.

## Current state

- `rg deleteLeague src/lib` is empty.
- Leagues are `ff_leagues.id` (`lg_…`). Child rows key `league_id`.
- `locked` desks are the imported demo — **refuse** delete on
  `locked` (same as other writes).
- Settings already has commish-only destructive-adjacent actions
  (waiver run, advance week). Match that density; do not add a red
  marketing modal library.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test src/lib/agent` | catalog still matches |
| Lint | `bunx biome check` on your files | exit 0 |

## Scope

**In scope**:
- `src/lib/league/engine.server.ts` — `deleteLeague(userId, leagueId)`
- `src/lib/league/fns.ts` — POST + `authMiddleware`
- `src/routes/league/$leagueId/settings.tsx` — commish confirm UI
- `src/lib/agent/catalog.ts` + `CATALOG.md` — `deleteLeague` commish
  workflow

**Out of scope**:
- Soft-delete / trash / undo
- Deleting Better Auth users
- Bulk "delete all my leagues"
- Changing `locked` demo semantics other than "cannot delete"

## Git workflow

- Branch: current
- Commit: `feat: let a commissioner delete their league`
- Do NOT push

## Steps

### Step 1: Server

`deleteLeague`: load league; throw if not commish; throw if `locked`;
delete child tables then `ff_leagues` (explicit `delete from … where
league_id = $1` for each known table, then the league row). Do not
`drop table`. List the tables from 034's dump list (rosters, spots,
matchups, claims, trades/sides/assets, wagers, pool, picks, queue,
events, allowlist, draft rows). If a table is missing, skip it
(`ensure*Schema` style), do not fail the whole delete.

**Verify**: `rg -n "export async function deleteLeague" src/lib/league/engine.server.ts`.
`rg -n "drop table" src/lib/league/engine.server.ts` in that function
is empty.

### Step 2: Fn + UI + catalog

POST validator `{ leagueId, confirmName }`. `confirmName` must equal
`league.name`. Settings: input + "Delete league" only if commish and
not locked. On success navigate to `/`. Catalog: commish, workflow,
mutating.

**Verify**: `bun test src/lib/agent`. `bun run typecheck`.

## Done criteria

- [ ] Commish + matching name deletes the league
- [ ] Non-commish / locked / wrong name throw
- [ ] Users table untouched
- [ ] Catalog updated

## STOP conditions

- You would `TRUNCATE` or drop auth tables
- Child table list is unclear and you are guessing — stop with the
  list you have
- 034 is not done and you want to block on it — report; operator can
  still confirm-by-name

## Maintenance notes

- wager-qa leftover leagues are the first customers of this.
- Reviewer: reject a delete that does not check commish_id.
