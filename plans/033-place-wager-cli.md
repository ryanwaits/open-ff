# Plan 033: Let the CLI place a wager when asked in writing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to
> the next step. If a STOP fires, report — do not improvise. Skip
> updating `plans/README.md` if a reviewer said they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7545fdb..HEAD -- scripts/ledger.mjs src/lib/agent/cli.test.mjs src/lib/agent/catalog.ts src/lib/league/wagers.server.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/027-faab-conservation.md (DONE — mint closed);
  plans/038-agent-context-dump.md (README order: write CLI after dump)
- **Category**: direction
- **Planned at**: commit `7545fdb`, 2026-08-19 (reconciled from `dd9bc53`;
  argv still refuses mutating tools)

## Why this matters

024 listed `placeWager` in the catalog and **refused** it from argv on
purpose: the book still minted. 027 closed that. An agent (or you) can
still only stake by clicking. The CLI is the harness surface. Wire
**one** mutating dispatch — `placeWager` — behind an explicit flag, same
engine function the ticket uses. Default remains refuse.

This is not a second book. `placeWager` in `wagers.server.ts` already
enforces spendable, fade-self, caps.

## Current state

Catalog grew (`deleteLeague`). CLI still read-only. `scripts/ledger.mjs:113-115`:

```js
if (tool.mutating) {
  fail(`${id} is mutating and is not dispatched from this CLI. …`);
}
```

`dispatchRead` only handles `getEvents` / `getLeagueFacts`.

`src/lib/agent/cli.test.mjs`: `--help` lists `placeWager`; argv
`placeWager` exits non-zero matching `/mutating|not dispatched/`.

`placeWager` (`wagers.server.ts`) takes `{ userId, leagueId, matchupId,
kind, sideRoster, line, stake }`. Kind is `spread | moneyline` only.

bun CLI has **no** session cookie. `DATABASE_URL` access is already
god-mode on the same DB. Pass `--user <id>` of a seat holder. Do **not**
invent a league API key.

Live bun still cannot migrate PGLite (`import.meta.glob`). Writes need
`DATABASE_URL` (same Postgres as the app).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Help    | `bun scripts/ledger.mjs --help` | lists placeWager; says writes need `--write` |
| Refuse  | `bun scripts/ledger.mjs placeWager --league lg_x` | non-zero, mutating / need --write |
| Tests   | `bun test src/lib/agent` | pass |
| Typecheck | `bun run typecheck` | exit 0 |

## Scope

**In scope**:
- `scripts/ledger.mjs` — parse `--write`, `--user`, stake fields;
  dispatch `placeWager` only
- `src/lib/agent/cli.test.mjs` — refuse without `--write`; help text
- `src/lib/agent/CATALOG.md` — one line that CLI write is opt-in

**Out of scope**:
- `makePick`, `voteTrade`, `addDrop`, or any other mutating tool
- Escrow / vig / new kinds
- A session cookie / OAuth device flow
- Wiring PGLite migrate for bun

## Git workflow

- Branch: current
- Commit: `feat: opt-in CLI dispatch for placing a FAAB wager`
- Do NOT push

## Steps

### Step 1: Flag + refuse by default

`--write` required. Without it, `placeWager` still fails with a message
that includes `not dispatched` **or** `--write`. Keep the
`tool.mutating` guard for every *other* mutating id.

**Verify**: existing `cli.test.mjs` "not dispatched" test still passes.

### Step 2: Dispatch

`bun scripts/ledger.mjs placeWager --write --user <id> --league <id>
--matchup <n> --kind spread|moneyline --side <rosterId> --line <n>
--stake <n>`

Import `placeWager` from `src/lib/league/wagers.server.ts` and call it
with those fields. Print the `{ id }` JSON. If `DATABASE_URL` is unset,
fail with the existing PGLite message — do not boot a RAM db to stake.

**Verify**: `rg -n "placeWager" scripts/ledger.mjs` hits the dispatch
(not just help). `rg -n "makePick" scripts/ledger.mjs` does not
dispatch.

### Step 3: Tests + catalog note

- Without `--write`: non-zero (already true).
- With `--write` but missing `--user` / `--stake`: non-zero, no DB.
- Help mentions `--write`.
- `CATALOG.md` placeWager row: "CLI requires --write and --user."

**Verify**: `bun test src/lib/agent` pass.

## Done criteria

- [ ] Default argv `placeWager` still refused
- [ ] `--write` + required flags call the real `placeWager`
- [ ] No other mutating tool dispatched
- [ ] `bun test src/lib/agent` pass

## STOP conditions

- You are about to dispatch `makePick` / `voteTrade` "while you're here"
- You would add a shared league API key
- `placeWager` signature no longer matches and you cannot wrap it in
  15 lines

## Maintenance notes

- 030's HTTP viewer does **not** apply to this import. `--user` must be
  a real seat; the engine still blocks fade-self and over-spend.
- Reviewer: reject a default-on write path.
