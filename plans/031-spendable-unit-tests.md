# Plan 031: Prove spendable and atRisk without a live database

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7545fdb..HEAD -- src/lib/league/faab.ts src/lib/league/wagers.server.ts src/lib/league/money.characterization.test.mjs src/lib/db.ts`
> Compare excerpts if those files moved.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/027-faab-conservation.md (DONE `9f512b5`)
- **Category**: tests
- **Planned at**: commit `7545fdb`, 2026-08-19 (reconciled from `dd9bc53`; skips unchanged)

## Why this matters

027 proved the *mint* with a pure `applyLoss`. Two 022 skips remain:

```
test.skip("spendable subtracts live stakes from the headline purse")
test.skip("atRisk sums placed-wager stakes")
```

They skip because `spendable` / `atRisk` call `getSql()`, and bun cannot
run Vite's `import.meta.glob` migrate (`src/lib/db.ts:143-147`). That is
a harness limit, not a money bug. Do **not** teach bun to migrate. Extract
the one-liners so a unit test can flip the skips.

## Current state

`wagers.server.ts` `spendable` (331-349):
`Math.max(0, (purse ?? 0) - (await atRisk(leagueId, rosterId)))`

`atRisk` (352-366): `sum(stake) where status = 'placed'`. Still
calls `getSql()` / `ensureWagerSchema`. `src/lib/db.ts` glob migrate
is 146-150 (PGLite close was added in `c8df5c0` — ignore it).

`faab.ts` already holds `applyLoss` (pure, no `getSql`). Add neighbors.

`money.characterization.test.mjs` — two `.skip`s, plus the passing
`applyLoss` mint case. Leave that passing test alone.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Tests   | `bun test src/lib/league` | 0 skip on spendable/atRisk |
| Typecheck | `bun run typecheck` | exit 0 |

## Scope

**In scope**:
- `src/lib/league/faab.ts` — add `atRiskFrom` + `spendableFrom`
- `src/lib/league/wagers.server.ts` — `atRisk` / `spendable` *use* those
  helpers after they have the numbers
- `src/lib/league/faab.test.mjs` — new cases
- `src/lib/league/money.characterization.test.mjs` — un-skip / replace
  with helper assertions

**Out of scope**:
- Vite `import.meta.glob` / a bun PGLite migrate
- Changing reservation rules (claims still do **not** reserve)
- Escrowing at `placeWager`
- Live DB tests

## Git workflow

- Branch: current
- Commit: `test: unit-test spendable and at-risk without a database`
- Do NOT push

## Steps

### Step 1: Pure helpers

In `faab.ts`:

```ts
export function atRiskFrom(stakes: number[]): number {
  return stakes.reduce((n, s) => n + Math.max(0, s), 0);
}
export function spendableFrom(remaining: number, atRisk: number): number {
  return Math.max(0, remaining - Math.max(0, atRisk));
}
```

`faab.test.mjs` (same node:test style as `applyLoss`):

- `atRiskFrom([70, 10])` → 80
- `spendableFrom(100, 70)` → 30
- `spendableFrom(20, 70)` → 0
- `spendableFrom(100, 0)` → 100

**Verify**: `bun test src/lib/league/faab.test.mjs` — all pass.

### Step 2: Wire the SQL wrappers

`atRisk`: after the SQL sum, `return atRiskFrom([row.n])` (or
`atRiskFrom` over the list if you change the query). Do not change the
`status = 'placed'` filter.

`spendable`: `return spendableFrom(purse ?? 0, await atRisk(...))`.

**Verify**: `rg -n "spendableFrom|atRiskFrom" src/lib/league/wagers.server.ts`
hits both wrappers.

### Step 3: Flip the skips

Replace the two `.skip` tests with passing helper assertions (or delete
them if `faab.test.mjs` already covers the numbers). Comment: live SQL
still needs a PGLite fixture; the math is no longer skipped.

**Verify**: `bun test src/lib/league/money.characterization.test.mjs`
— 0 skip. `bun test src/lib/league` — 0 fail.

## Done criteria

- [ ] Helpers exist and wrappers use them
- [ ] No skipped spendable/atRisk test remains
- [ ] `bun test src/lib/league` and `bun run typecheck` pass
- [ ] No bun-migrate experiment

## STOP conditions

- You believe you must boot PGLite under bun to finish — stop; helpers
  are the proof
- You are about to change which rows `atRisk` sums — stop

## Maintenance notes

- A later live fixture can assert the SQL wrapper equals the helper.
  That is not this plan.
