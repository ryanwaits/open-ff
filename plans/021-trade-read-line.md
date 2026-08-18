# Plan 021: The read line — one sentence that arranges the numbers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 304cfb7..HEAD -- src/lib/league/lineup-value.ts src/components/trade-offer-card.tsx src/components/trade-composer.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/016 (`tradeDelta`), plans/018 and/or plans/019 (the two
  surfaces it renders into)
- **Category**: direction
- **Planned at**: commit `304cfb7`, 2026-08-17

## Why this matters

`tradeDelta` produces a correct number and a list of changed slots. A person
still has to read four figures and work out which one matters. One sentence —
"+2.1 a week to your starters; Cook upgrades RB2 by 1.8; Etienne is on a bye in
week 10" — does that work for them.

The constraint that makes this safe: **the app computes every number; the
sentence only chooses which two are worth saying.** No grades, no "you win this
trade", nothing the data cannot support.

## Current state

### What you have to work with

`tradeDelta` (`src/lib/league/lineup-value.ts`, plan 016) returns:

```ts
export type TradeDelta = {
  before: LineupValue;
  after: LineupValue;
  /** after.total - before.total, rounded to one decimal. */
  change: number;
  /** Only slots whose occupant changed. */
  changed: Array<{
    slot: string;
    from: RosterPlayer | null;
    to: RosterPlayer | null;
    delta: number;
  }>;
};
```

Bye weeks come from `getByeWeeks` (`src/lib/data/fns.ts`), already fetched with
a 12-hour `staleTime` on the home page. Injury status is on `RosterPlayer`.

### Where it goes

- The offer card's consequence sentence (plan 018 step 1, item 4) — written
  there as a single computed string precisely so it can be swapped here.
- The composer's balance panel (plan 019).

### The tone to match

Read `src/lib/league/desk-voice.ts` before writing copy. The register is plain
and specific: no exclamation marks, no hype, no second-guessing the reader.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `npm run typecheck` | exit 0              |
| Tests     | `npm test`          | all pass            |
| Build     | `npm run build`     | exit 0              |

No new packages.

## Scope

**In scope**:
- `src/lib/league/trade-read.ts` (create) — pure, typed, client-safe
- `scripts/trade-read.test.mjs` (create)
- `src/components/trade-offer-card.tsx` — use it
- `src/components/trade-composer.tsx` — use it

**Out of scope** (do NOT touch):
- `tradeDelta` itself. If the read needs a figure it does not expose, report it
  rather than widening plan 016's contract here.
- Any model call. This is deterministic string assembly — see the note below.
- Grades, scores, or a recommendation to accept or decline.
- The desk write-up (plans 013/014). Different surface, different voice.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: say what a trade does in one line`

## Steps

### Step 1: The module

Create `src/lib/league/trade-read.ts`:

```ts
/**
 * One sentence about a trade.
 *
 * Everything here is arrangement: the app computes the numbers, and this picks
 * the two or three worth saying. Deliberately deterministic rather than a model
 * call — the sentence is short, the inputs are numeric, and a language model
 * would add latency and a chance of inventing a figure that is not in the data.
 * If a fuller read is ever wanted, this is the function to swap.
 *
 * It never evaluates. "+2.1 projected" is a fact; "you win this trade" is not
 * something the projection can support.
 */
export function readTrade(input: {
  delta: TradeDelta;
  /** Players entering and leaving, for bye and injury notes. */
  incoming: RosterPlayer[];
  outgoing: RosterPlayer[];
  byes?: Record<string, number>;
  week?: number;
}): string;
```

Compose at most three clauses, in this order:

1. **The change** — always. `"+2.1 a week to your starters."` Use "no change to
   your starters" when it rounds to zero.
2. **The biggest gain**, if any slot improved by more than 0.05 —
   `"Cook upgrades RB2 by 1.8."`
3. **The biggest loss**, if any slot dropped — either the backfill
   (`"Prescott has to cover QB, which costs 7.9."`) or, when the slot empties,
   `"QB is left empty."`

Then at most **one** caveat, whichever applies first: an incoming player on a
bye within the next three weeks, or an incoming player with an injury
designation.

Hard cap: **three clauses plus one caveat**. Longer than that and nobody reads
it, which defeats the purpose.

**Verify**: `npm run typecheck` → exit 0.
`grep -c "getSql\|\.server\|node:" src/lib/league/trade-read.ts` → `0`.

### Step 2: Tests

`npm test` runs `node --test 'scripts/**/*.test.mjs'` (`package.json`), so the
file goes in `scripts/`. Cover:

1. A neutral trade says "no change to your starters" and nothing else.
2. A trade that upgrades one slot names the slot and the gain.
3. A trade that downgrades one slot names the player who has to cover.
4. An empty slot reads "left empty", not "undefined".
5. A bye caveat appears when an incoming player is on a bye within three weeks,
   and does **not** appear for a bye eight weeks out.
6. The output never contains "win", "lose", "great", "bad", or "should" —
   assert against that list. This is the guard that keeps the sentence
   descriptive.

**Verify**: `npm test` → all pass, including 6 new tests.

### Step 3: Use it in both surfaces

Replace the consequence sentence in `trade-offer-card.tsx` and the read line in
`trade-composer.tsx` with a `readTrade(...)` call. Both already compute a
`TradeDelta`.

If only one of plans 018 / 019 has landed, wire the one that exists and say so
in your report.

**Verify**: `npm run build` → exit 0. In `npm run dev`, an offer and a composed
deal both show a sentence, and a neutral trade reads sensibly rather than
awkwardly.

## Test plan

- **6 new tests** in `scripts/trade-read.test.mjs`, listed in step 2. Use plain
  `node:test` with `node:assert`; there is no existing test to model
  structurally beyond `scripts/lineup-value.test.mjs` from plan 016, if it
  exists.
- Manual: read the sentence on three real trades — one clear upgrade, one clear
  downgrade, one bench-for-bench. Each should read like something a person would
  write. Record all three in your report.
- `npm test` stays green.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0 **and** reports the 6 new tests
- [ ] `src/lib/league/trade-read.ts` is pure — no `getSql`, no `.server`
      import, no `node:` import, no network call
- [ ] The evaluative-language test passes (step 2, case 6)
- [ ] At most three clauses plus one caveat
- [ ] Both trade surfaces that exist use it
- [ ] `tradeDelta` is unmodified
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 021 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `tradeDelta` does not expose `changed` with `from` / `to` / `delta`.
- The sentence needs a number `tradeDelta` does not return. Report what is
  missing; do not compute it inside the read module, which would put two
  sources of truth on the same screen.
- You are asked, or tempted, to route this through a language model. Read the
  module comment first: the inputs are numeric and the output is one sentence,
  so a model buys nothing and risks a figure that is not in the data. If a
  richer read is genuinely wanted, that is a new plan with its own guardrails.
- The output reads as advice rather than description. That is the failure this
  plan exists to prevent.

## Maintenance notes

- **Deterministic is a decision, not a limitation.** The interesting version of
  this is a model summarising a whole trade in context — and that belongs in the
  desk's voice (plans 013/014), where facts are already threshold-gated. On the
  trade screen the number is the product and the sentence is a label.
- **The banned-words test is the real guard.** Anyone extending this will be
  tempted toward "this looks like a good deal"; the test makes that fail loudly.
- **Three clauses is a ceiling, not a target.** Most trades deserve one.
- A reviewer should read the sentence for a bench-for-bench trade — the case
  where a generated line most easily becomes noise.
