# Plan 034: Let a commish download their league

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to
> the next step. If a STOP fires, report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat dd9bc53..HEAD -- src/lib/league/fns.ts src/lib/league/engine.server.ts src/routes/league/$leagueId/settings.tsx src/lib/agent/catalog.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/025-self-host-pickup.md (DONE — self-host exists,
  no dump)
- **Category**: dx
- **Planned at**: commit `dd9bc53`, 2026-08-19

## Why this matters

A self-hosted league's only copy is the Postgres (or on-disk PGLite)
the commish pointed at. There is no export. A disk death or a bad
migrate is a silent wipe of FAAB, rosters, and the book. 025 listed
this as the next self-host gap. Give the commish a JSON download of
**their** league. Restore can be a later plan; a file they can copy
off-box is the first half of backup.

## Current state

- No `exportLeague` / `backup` symbol in `src/lib/league/fns.ts`.
- Settings is commish-gated for writes; `getSettings` is a viewer GET
  after 028.
- Dual schema: `migrations/*.sql` + `ensure*Schema`. Dump **rows**,
  not "run these creates."
- Catalog (`src/lib/agent/catalog.ts`) must gain a row if you add a
  server fn (024 rule). Ids match `export const X = createServerFn`.

Tables that *are* the league (read, do not invent): `ff_leagues`,
`ff_rosters`, `ff_spots`, `ff_matchups` / schedule, `ff_claims`,
`ff_trades` + sides/assets, `ff_wagers`, `ff_pool`, `ff_picks`,
`ff_queue`, `ff_events`, `ff_allowlist`, draft board if present.

Do **not** dump Better Auth `"user"` / `account` / `session` (password
hashes).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test src/lib/agent` | catalog ids still match |
| Lint | `bunx biome check` on your files | exit 0 |

## Scope

**In scope**:
- `src/lib/league/engine.server.ts` — `exportLeague(userId, leagueId)`
  commish-only; returns a JSON-serializable snapshot `{ v: 1, leagueId,
  exportedAt, tables: { … } }`
- `src/lib/league/fns.ts` — `exportLeague` GET, `authMiddleware`
- `src/routes/league/$leagueId/settings.tsx` — commish "Download backup"
  button that triggers a file download (`open-ff-<leagueId>.json`)
- `src/lib/agent/catalog.ts` + `CATALOG.md` — `exportLeague` commish read

**Out of scope**:
- Restore / import-from-backup (new plan if this file exists)
- Dumping `"user"` / sessions / password hashes
- Emailing the file
- S3 / cron offsite
- `deleteLeague` (036)

## Git workflow

- Branch: current
- Commit: `feat: let a commissioner download a league backup`
- Do NOT push

## Steps

### Step 1: Server dump

`exportLeague`: `getLeague`, require `commish_id === userId`,
`assertLeagueViewer` is not enough (members should not walk away with
the whole book). Select each table `where league_id = $1`. Return
plain objects (dates as ISO strings).

**Verify**: `rg -n "export async function exportLeague" src/lib/league/engine.server.ts`.
`rg -n "from \"user\"" src/lib/league/engine.server.ts` in that function
is empty.

### Step 2: Fn + catalog + button

`createServerFn` GET + `authMiddleware` + `{ leagueId }`. Catalog:
commish, read, not mutating. Settings: only if `isCommish`, button
downloads JSON. Do not restyle the page.

**Verify**: `bun test src/lib/agent` (ids match markdown + fns).
`bun run typecheck`.

## Done criteria

- [ ] Commish can download JSON for their `lg_`
- [ ] Non-commish fn throws
- [ ] No auth tables in the payload
- [ ] Catalog updated
- [ ] `bun run typecheck` and `bun test src/lib/agent` pass

## STOP conditions

- You start writing restore — out of scope
- You would include `hashedPassword` / session tokens
- Dump is too large to return via createServerFn and you need a stream
  — stop and report; do not invent S3

## Maintenance notes

- Bump `v` if the snapshot shape changes. Restore (later) keys off `v`.
- 036 delete should remind the commish to download first.
