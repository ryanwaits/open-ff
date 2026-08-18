# Plan 022: Prove FAAB, settlement, and clock with tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 553f159..HEAD -- package.json src/lib/league/wagers.server.ts src/lib/league/ops.server.ts src/lib/league/scoring.ts src/lib/league/win-probability.ts src/lib/league/engine.server.ts src/lib/league/mock-draft.test.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `553f159`, 2026-08-17

## Why this matters

The north star is agents composing league primitives (stake FAAB, file a claim,
propose a trade, pick a player). Those primitives are currently untested.
`bun test` only runs `scripts/**/*.test.mjs`. `plans/README.md` claims
"direct database tests" for supply conservation, pool-shortfall, and fair
odds — those files are not in the repo. `engine.server.ts` is `@ts-nocheck`,
so typecheck is not a substitute.

If an MCP/CLI later wraps these functions, a wrong `settleWeek` or a minted
FAAB dollar becomes an agent-amplified bug. Characterization first.

## Current state

- `package.json:17` — `"test": "bun test scripts"`
- `src/lib/league/mock-draft.test.mjs` exists and is **not** in that glob
- `src/lib/league/wagers.server.ts:59-64` — `payoutMultiplier` clamps p to [0.05, 0.95]
- `src/lib/league/wagers.server.ts:8-16` states: manager balances + pool = genesis forever
- `src/lib/league/wagers.server.ts:474-479` — loser: `greatest(0, remaining - stake)` then `movePool(+stake)` for the **full** stake
- `src/lib/league/ops.server.ts:370-413` — waiver award uses headline `faab_remaining`, not `spendable()`
- `src/lib/league/ops.server.ts:830-859` — `snapshotWeek` no-ops if any result row exists; `settleWeek` is in a swallowed try/catch
- `src/lib/league/engine.server.ts:1081-1102` — `claimPick` is check-then-act, update is not `WHERE player_id IS NULL`
- `src/lib/league/scoring.ts:1` — `ScoringBook = Record<string, number>`; `applyBook` is the live scorer
- `src/lib/db.ts:27-36` — `Sql` has **no** `transaction` helper
- Convention: existing tests use `node:test` + `node:assert/strict` (see `src/lib/league/mock-draft.test.mjs` and `scripts/query-persist.test.mjs`). Match that. Do **not** add vitest/jest.

## Commands you will need

| Purpose   | Command                         | Expected on success |
|-----------|---------------------------------|---------------------|
| Tests     | `bun test src scripts`          | all pass, including new files |
| Typecheck | `bun run typecheck`             | exit 0              |
| Lint      | `bun run lint`                  | exit 0              |

## Scope

**In scope**:
- `package.json` — expand the `test` script glob only
- `src/lib/league/scoring.test.mjs` (create)
- `src/lib/league/wagers.test.mjs` (create)
- `src/lib/league/win-probability.test.mjs` (create)
- `src/lib/league/money.characterization.test.mjs` (create) — documents current conservation *behavior*, including the mint/clamp bugs
- `src/lib/db.ts` — only if a test fixture needs a tiny `withPglite` helper; prefer importing `getSql` after setting no `DATABASE_URL`

**Out of scope**:
- Fixing the conservation / settle / claimPick bugs (that is 023's sibling — do not "fix while testing" unless a test cannot even import the module)
- Removing `// @ts-nocheck` from `engine.server.ts`
- MCP, CLI, UI, migrations
- `src/lib/league/mock-draft.test.mjs` content (just make the glob run it)

## Git workflow

- Branch: stay on current branch unless told otherwise
- Commit style: `test: cover scoring, odds, and FAAB conservation`
- Do NOT push

## Steps

### Step 1: Run the existing mock-draft tests under the new glob

Change `package.json` `"test"` to `bun test src scripts`.

**Verify**: `bun test src/lib/league/mock-draft.test.mjs` → 2 passing.

### Step 2: Pure unit tests for `applyBook` and `payoutMultiplier`

Create `src/lib/league/scoring.test.mjs`:
- PPR: 10 rec, 100 rec yd, 1 rec TD → 10 + 10 + 6 = 26 under classic `bookFromPreset("ppr")`
- Half-PPR: same line is 21
- DST bucket: `pts_allow_0` scores only that key
- Import `bookFromPreset` / `applyBook` from `./scoring.ts`

Create `src/lib/league/wagers.test.mjs`:
- `payoutMultiplier(0.25)` → 3
- `payoutMultiplier(0.75)` → ~0.33
- `payoutMultiplier(0.01)` equals `payoutMultiplier(0.05)` (clamp)
- `payoutMultiplier(0.99)` equals `payoutMultiplier(0.95)`

Create `src/lib/league/win-probability.test.mjs`:
- Equal projections → ~50
- Large home edge → homePct > 70
- Import from `./win-probability.ts`

**Verify**: `bun test src/lib/league/scoring.test.mjs src/lib/league/wagers.test.mjs src/lib/league/win-probability.test.mjs` → all pass.

### Step 3: Characterization of the one-balance claim (document, do not fix)

Create `src/lib/league/money.characterization.test.mjs`.

This file's job is to **pin current behavior**, including the known mint:
- Import `payoutMultiplier`, `spendable`, `atRisk` if they can run without a DB.
- If `spendable`/`placeWager` need Postgres, skip the DB cases with `test.skip` and a comment `needs PGLite fixture` — do **not** invent a full app bootstrap if `getSql` cannot be imported from a test in under 30 lines.
- At minimum, add a **commented fixture** (as a skipped test) that states the invariant we *want*:

```
// WANT: after a $70 lost wager and an $80 winning claim on a $100 purse,
// remaining + pool + burned_claims === genesis. TODAY: pool is credited
// the full $70 even when remaining only had $20 (wagers.server.ts:474-479).
```

If you can cheaply boot PGLite the same way `src/lib/db.ts` does (no `DATABASE_URL`, `ensureWagerSchema` + insert league/roster/pool), write a live test that:
1. Seeds one league, one roster at $100, pool at $200
2. Places a $70 wager and files an $80 claim
3. Awards the claim, then settles the wager as a loss
4. Asserts the **actual** numbers (so a later fix will fail this test on purpose)

Name that test `current: claim then lose can mint pool dollars` so 023 can flip it.

**Verify**: `bun test src/lib/league/money.characterization.test.mjs` → pass or skip, never hang.

### Step 4: Wire `npm test` / `bun test`

`package.json` `"test": "bun test src scripts"`.

**Verify**: `bun test` → mock-draft + new files + existing scripts tests all pass. No new failures in `scripts/`.

## Test plan

- New files listed above.
- Pattern: `src/lib/league/mock-draft.test.mjs`.
- Do not snapshot whole engine responses.

## Done criteria

- [ ] `bun test` runs `src` and `scripts`; `mock-draft.test.mjs` is included
- [ ] `applyBook` and `payoutMultiplier` have table tests that pass
- [ ] Conservation mint is either asserted as current behavior or documented in a skipped fixture with the file:line cited
- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] No files outside scope
- [ ] `plans/README.md` status row updated

## STOP conditions

- `getSql` / PGLite cannot be imported from a test without starting Vite — skip DB tests, do not rewrite `db.ts` beyond a 20-line helper
- Scoring numbers you compute from `bookFromPreset` disagree with `applyBook` by more than a DST/bonus rule you do not understand — stop and report, do not "fix" `applyBook`
- You feel the need to change `settleWeek` or `processWaivers` to make a test pass

## Maintenance notes

- A later plan that **fixes** conservation must update `current: claim then lose can mint pool dollars` to the desired invariant, not delete it.
- Agent tools (024) must not ship until this suite is green.
- Reviewer: reject any "fix" that lands in this plan.
