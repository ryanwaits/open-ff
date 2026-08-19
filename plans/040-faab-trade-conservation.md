# Plan 040: Do not mint FAAB when a trade is accepted after the purse moved

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to
> the next step. If a STOP fires, report — do not improvise. When done,
> update your row in `plans/README.md` unless a reviewer said they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dd9bc53..HEAD -- src/lib/league/ops.server.ts src/lib/league/faab.ts src/lib/league/faab.test.mjs src/lib/league/money.characterization.test.mjs`
> On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/027-faab-conservation.md (DONE — wager *settle*
  no longer mints; trade *execute* still can)
- **Category**: bug
- **Planned at**: commit `dd9bc53`, 2026-08-19

## Why this matters

027 closed the documented mint: a lost wager pools only what the purse
still holds (`applyLoss`). FAAB-in-a-trade was checked at **propose**
against `spendable` (`ops.server.ts:547-556`) and then at **execute**
debited with `greatest(0, remaining - amount)` while the receiver is
**credited the full amount** (`ops.server.ts:748-757`). If the sender
stakes or wins a claim between propose and accept, remaining $20 +
trade $30 → sender 0, receiver +30, league total +10.

An agent that composes `placeWager` then `voteTrade` (or a human who
does the same) can mint. Conservation is the invariant that makes the
catalog safe to hand to a loop.

## Current state

Propose (honest):

```547:556:src/lib/league/ops.server.ts
    if (a.kind === "faab") {
      const amount = Math.floor(a.amount ?? 0);
      ...
      const free = await spendable(leagueId, a.fromRoster);
      if (amount > free) {
        throw new Error(`That team only has $${free} to trade.`);
      }
    }
```

Execute (the hole):

```748:757:src/lib/league/ops.server.ts
    } else if (a.kind === "faab" && a.amount) {
      await sql`
        update ff_rosters set faab_remaining = greatest(0, coalesce(faab_remaining, 0) - ${a.amount})
        where league_id = ${leagueId} and roster_id = ${a.from_roster}
      `;
      await sql`
        update ff_rosters set faab_remaining = coalesce(faab_remaining, 0) + ${a.amount}
        where league_id = ${leagueId} and roster_id = ${a.to_roster}
      `;
    }
```

`applyLoss` (`faab.ts:2-12`) already returns `{ remaining, poolCredit }`
where `poolCredit` is "cash actually taken." Reuse it: the receiver gets
`poolCredit`, not `a.amount`. If `poolCredit === 0` and `a.amount > 0`,
**throw** and do not apply the rest of the trade — a silent $0 transfer
would let a player-for-FAAB deal go through with no cash.

Do **not** change propose. Do **not** escrow.

Pending claims still do not reserve (by design, `wagers.server.ts:326-329`).
Live stakes *do* reserve via `spendable`. Execute must use spendable (or
applyLoss on remaining, which is weaker than spendable if a stake is
live). **Use spendable as the ceiling, then debit exactly that take.**

Preferred execute shape:

```ts
const { spendable } = await import("./wagers.server");
const free = await spendable(leagueId, a.from_roster);
const take = Math.min(free, Math.max(0, a.amount));
if (take !== a.amount) {
  throw new Error(`That team only has $${free} to trade.`);
}
// then debit take from from_roster, credit take to to_roster
```

Throwing is better than silently shrinking: the other assets in the
same deal must not complete if the FAAB leg cannot. `executeTrade` is
not in a SQL transaction today — if you cannot wrap the whole execute
in one transaction, **check every FAAB leg first**, then apply all
assets. Do not apply players and then throw on FAAB.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Tests | `bun test src/lib/league/faab.test.mjs src/lib/league/money.characterization.test.mjs` | pass, 0 skip on this mint |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bunx biome check` on files you edit | exit 0 |

## Scope

**In scope**:
- `src/lib/league/ops.server.ts` — `executeTrade` FAAB branch (+ a
  pre-pass that refuses the deal if any FAAB leg exceeds spendable)
- `src/lib/league/faab.ts` — optional `tradeTake(free, amount)` helper
  if it keeps the unit test off `getSql`; otherwise inline `Math.min`
- `src/lib/league/faab.test.mjs` and/or `money.characterization.test.mjs`
  — characterization: short purse + full credit is **illegal**

**Out of scope**:
- Wrapping all of `executeTrade` in a DB transaction unless it is <20
  lines and obviously correct
- Changing propose, placeWager, applyLoss-on-settle
- Teaching bun to migrate PGLite
- CLI

## Git workflow

- Branch: current
- Commit: `fix: refuse a FAAB trade when the sender cannot cover it`
- Do NOT push

## Steps

### Step 1: Unit the rule

In `faab.ts` (next to `applyLoss`):

```ts
export function tradeTake(spendable: number, amount: number): number {
  const want = Math.max(0, Math.floor(amount));
  const have = Math.max(0, spendable);
  return want > have ? -1 : want;
}
```

`-1` means refuse. Tests:

- `tradeTake(30, 30) === 30`
- `tradeTake(20, 30) === -1`
- `tradeTake(20, 0) === 0`

**Verify**: `bun test src/lib/league/faab.test.mjs`.

### Step 2: Pre-pass then debit

At the start of the FAAB handling in `executeTrade` (or just before the
asset loop): for each `a.kind === "faab"`, `spendable` then `tradeTake`.
If any returns `-1`, throw `That team only has $${free} to trade.`
**before** any `update ff_spots` / `update ff_rosters` for this execute.

Then debit/credit `take` (which equals `a.amount`). Delete the
`greatest(0, remaining - amount)` debit.

**Verify**: `rg -n "greatest\\(0, coalesce\\(faab_remaining" src/lib/league/ops.server.ts`
no longer hits the FAAB-trade branch (other greatest() elsewhere may
remain). `rg -n "tradeTake" src/lib/league/ops.server.ts`.

### Step 3: Characterization

In `money.characterization.test.mjs` add a passing test that names the
old mint (20 remaining, 30 trade, credit 30 ⇒ genesis +10) and asserts
`tradeTake(20, 30) === -1`. Do not skip it.

**Verify**: `bun test src/lib/league/money.characterization.test.mjs`
— new test runs, not skipped.

## Test plan

- Pure helper tests (no DB).
- Live `executeTrade` still skipped under bun — same 022/031 limit.
  The helper + source-string `tradeTake` use is the proof this slice
  can give.

## Done criteria

- [ ] Execute throws if spendable < amount
- [ ] Receiver is never credited more than sender is debited
- [ ] Propose path unchanged
- [ ] `bun test src/lib/league/faab.test.mjs` pass
- [ ] `bun run typecheck` pass

## STOP conditions

- You would silently shrink the FAAB leg and still move players
- You change claim reservation rules
- `executeTrade` structure does not have a single asset loop and you
  cannot find a pre-pass without a rewrite — stop and report the shape

## Maintenance notes

- Same class of bug as 027: clamp-on-debit + full-credit. Any future
  "move FAAB" path must take-then-credit the *take*.
- Reviewer: reject a credit of `a.amount` after a clamped debit.
