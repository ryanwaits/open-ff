# Plan 027: Stop a lost wager from minting FAAB

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b918703..HEAD -- src/lib/league/wagers.server.ts src/lib/league/ops.server.ts src/lib/league/money.characterization.test.mjs`
> If those files drifted, compare the excerpts below before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/022-money-characterization.md (DONE — skipped fixture documents the mint)
- **Category**: bug
- **Planned at**: commit `b918703`, 2026-08-18
- **Landed**: `9f512b5` (not pushed)
- **Verified**: `dd9bc53` (reconcile 2026-08-19)

## Why this matters

The book claims manager balances + the house pool + burned waiver bids
always equal the genesis figure. A losing wager does `greatest(0, remaining
- stake)` then credits the **full** stake to the pool. File an $80 claim
then lose a $70 ticket on a $100 purse: remaining becomes 0, pool grows by
70, $50 appears. Agents and the ticket share this purse. Do not let
`placeWager` keep inventing dollars.

Waivers that *burn* FAAB are not a mint. They are a sink. The invariant to
assert is:

```
remaining + pool + burned_winning_claims === genesis
```

## Current state

`src/lib/league/wagers.server.ts`

- `spendable` (339-357): `remaining - atRisk`. Pending claims do **not**
  reserve. Live wagers do.
- `placeWager` inserts a `placed` row and does **not** debit
  `faab_remaining`.
- `settleWeek` losers (474-479):

```ts
update ff_rosters set faab_remaining = greatest(0, coalesce(faab_remaining, 0) - ${w.stake})
// then
movePool(leagueId, w.stake)  // full stake, even if remaining was smaller
```

`src/lib/league/ops.server.ts` `processWaivers` (398-411): awards if
`c.bid > cash` is false, where `cash` is headline `faab_remaining`, **not**
`spendable()`. A $70 live stake still leaves cash=100, so an $80 claim
wins.

`src/lib/league/money.characterization.test.mjs` — skipped test
`current: claim then lose can mint pool dollars` spells the numbers
(remaining 0, pool 270, burned 80, genesis 300, mint 50).

bun cannot boot PGLite migrate (`import.meta.glob`). Do **not** depend on
a live `getSql()` fixture. Extract the debit math so a unit test can flip.

## Commands you will need

| Purpose   | Command                                      | Expected |
|-----------|----------------------------------------------|----------|
| Tests     | `bun test src/lib/league`                    | pass, 0 skip on the mint case |
| Typecheck | `bun run typecheck`                          | exit 0   |
| Lint      | `bunx biome check` on files you edit         | exit 0   |

## Scope

**In scope**:
- `src/lib/league/wagers.server.ts` — extract + use debit helper in
  `settleWeek` loser path; optionally use `spendable` from
  `processWaivers` via a small export
- `src/lib/league/ops.server.ts` — award claims against `spendable()`,
  not headline cash
- `src/lib/league/money.characterization.test.mjs` — un-skip / replace
  with a passing unit test of the helper + a comment that the old mint
  is gone
- `src/lib/league/faab.ts` (create) **if** you need a DB-free module for
  the helper. Prefer this over teaching bun to migrate.

**Out of scope**:
- Escrowing the stake at `placeWager` time (allowed later; not required
  if settle only pools the actual debit **and** waivers respect
  `spendable`)
- Changing vig / `payoutMultiplier`
- UI, catalog, tick, invite/allowlist (028)
- Wager ticket click-through (029)
- Removing `// @ts-nocheck` on `engine.server.ts`

## Git workflow

- Branch: current branch
- Commit: `fix: do not mint FAAB when a lost wager exceeds the purse`
- Do NOT push

## Steps

### Step 1: Extract debit math

Create `src/lib/league/faab.ts` (pure, no `getSql`):

```ts
/** Cash actually taken from a purse, and what the pool may be credited. */
export function applyLoss(remaining: number, stake: number): {
  remaining: number;
  poolCredit: number;
} {
  const cash = Math.max(0, remaining);
  const take = Math.min(cash, Math.max(0, stake));
  return { remaining: cash - take, poolCredit: take };
}
```

Unit test in `src/lib/league/faab.test.mjs` (node:test, like
`scoring.test.mjs`):

- `applyLoss(100, 70)` → remaining 30, poolCredit 70
- `applyLoss(20, 70)` → remaining 0, poolCredit 20 (the mint case)
- `applyLoss(0, 70)` → remaining 0, poolCredit 0

**Verify**: `bun test src/lib/league/faab.test.mjs` → 3 pass.

### Step 2: Settle with the helper

In `settleWeek` loser loop, read current `faab_remaining` (or use the
row you already have), call `applyLoss`, write `remaining`,
`movePool(leagueId, poolCredit)` — **never** `movePool(full stake)`
when `poolCredit < stake`. Keep the `WHERE status = 'placed'` habit if
you touch the wager row; do not invent a new settlement order
(losers still fund the pool before winners).

**Verify**: `rg -n "movePool" src/lib/league/wagers.server.ts` — loser
path uses `poolCredit` / `applyLoss`, not a raw `w.stake` credit unless
you just computed they are equal.

### Step 3: Award waivers against spendable

In `processWaivers`, replace `c.bid > cash` with a check against
`spendable(leagueId, c.roster_id, cash)` (import from
`wagers.server.ts`). If `spendable` would create a cycle, duplicate the
one-liner `cash - atRisk` in `ops.server.ts` via `atRisk` only.

A claim that would leave remaining below live stakes loses with
`reason: "short"` (already a payload reason).

**Verify**: `rg -n "spendable|atRisk" src/lib/league/ops.server.ts` hits
the award loop.

### Step 4: Flip the characterization test

Replace the skipped `current: claim then lose can mint pool dollars`
with a **passing** test that `applyLoss(20, 70).poolCredit === 20` and
`20 + 200 + 80 === 300` (genesis). Delete or un-skip the old "assert
the mint" wording so a later reader does not think 350 is desired.

Leave `spendable` / `atRisk` DB skips if they still need PGLite.

**Verify**: `bun test src/lib/league/money.characterization.test.mjs src/lib/league/faab.test.mjs` — mint case is **not** skipped; it passes.

## Test plan

- New `faab.test.mjs` as above.
- Characterization file documents the invariant, not the bug.
- Pattern: `src/lib/league/scoring.test.mjs`.

## Done criteria

- [ ] `applyLoss` exists and is used on the loser settle path
- [ ] Pool is never credited more than the purse actually lost
- [ ] Waiver award uses spendable (or remaining − atRisk)
- [ ] The old skipped mint test no longer asserts a $50 invention
- [ ] `bun test src/lib/league` and `bun run typecheck` pass
- [ ] No files outside scope

## STOP conditions

- You think you must rewrite `placeWager` to escrow in order to finish —
  report; steps 2+3 are enough for this plan
- `movePool` / winner payout math is unclear after your edit — stop
  rather than changing how winners are scaled
- You need a live PGLite migrate to prove it — do not; the helper is
  the proof

## Maintenance notes

- 024's catalog may list `placeWager`. Do not wire a mutating CLI until
  this lands.
- 029 clicks the ticket — run 027 first so a human/scripted click does
  not mint.
- Reviewer: reject any `greatest(0, remaining - stake)` that still
  `movePool(stake)`.
