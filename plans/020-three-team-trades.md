# Plan 020: Three-team trades — every asset says where it lands

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 304cfb7..HEAD -- src/components/trade-composer.tsx src/routes/league/\$leagueId/trades.tsx src/lib/league/ops.server.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/019 (extends the composer it creates)
- **Category**: direction
- **Planned at**: commit `304cfb7`, 2026-08-17

## Why this matters

Three-team trades already work end to end — the engine, the schema and the old
form all support them. What they lack is a presentation anyone can follow. In a
two-team deal the destination of an asset is obvious; in a three-way it is the
single thing people get wrong, and the current UI expresses it as a row of
destination chips above a scrolling list.

This plan gives the third team a shape: one tabbed roster column, a deal panel
split into legs, and a destination pill on every chip.

## Current state

### It already works

`src/routes/league/$leagueId/trades.tsx` still carries the state
(after 019, ~66 and the third* setters):

```tsx
  const [thirdId, setThirdId] = useState<number | null>(null);
  const [thirdPlayers, setThirdPlayers] = useState<string[]>([]);
  const [thirdPicks, setThirdPicks] = useState<number[]>([]);
  const [mineTo, setMineTo] = useState<number | null>(null);
  const [themTo, setThemTo] = useState<number | null>(null);
  const [thirdTo, setThirdTo] = useState<number | null>(null);
```

`proposeTrade` (`src/lib/league/ops.server.ts`) takes assets each carrying their
own `fromRoster` and `toRoster`, and requires every involved side to accept:

```ts
  if (!sides.has(mine.roster_id)) throw new Error("You have to be in the trade.");
  if (sides.size < 2) throw new Error("Need at least two teams.");
```

So a three-way is just more assets. **No server change is needed in this plan.**

### What plan 019 left behind (HEAD `ec855c3`)

`TradeComposer` is two-team only. When `thirdId` is set, trades.tsx hides the
composer and shows the old AssetCol grid + send mutation. The "Add a third
team" toggle still lives in the Propose section. This plan folds the third
team into TradeComposer and deletes AssetCol.

Book section / TradeOfferCard is 018 — do not rewrite it.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `npm run typecheck` | exit 0              |
| Tests     | `npm test`          | all pass            |
| Build     | `npm run build`     | exit 0              |
| Dev       | `npm run dev`       | serves on :8080     |

No new packages.

## Scope

**In scope**:
- `src/components/trade-composer.tsx` — a three-team mode
- `src/routes/league/$leagueId/trades.tsx` — remove `AssetCol` once dead

**Out of scope** (do NOT touch):
- `proposeTrade`, `voteTrade`, the schema. Three teams already work.
- The offer card (plan 018). Rendering a received three-way is a follow-up; note
  it rather than doing it here.
- Four or more teams. `sides.size < 2` permits it but nobody has asked, and the
  tabbed column stops working past three.
- `src/components/draft-trade-drawer.tsx` — in-draft trading, plan 011.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: make a three-team trade legible`

## Steps

### Step 1: Tab the roster column

When a third team is present, the left and right roster panels collapse to
**one** panel with a tab per counterparty, plus a `+ Team` control. Three roster
lists side by side do not fit at this density and you only read one at a time.

With two teams the layout is unchanged from plan 019.

**Verify**: `npm run typecheck` → exit 0. In `npm run dev`, adding a third team
switches to the tabbed layout and removing it switches back.

### Step 2: Legs, with destinations

The deal panel becomes one **leg per sending team** — "You send", "{B} sends",
"{C} sends" — and every chip carries a destination pill reading `→ {team}`.

The pill is **hidden with two teams** (there is only one place anything can go)
and **always shown with three**. Default a new asset's destination to the team
that is not the sender, and when both are possible default to you, since most
three-ways are built around what you are getting.

**Verify**: with three teams every chip shows a destination; with two, none do.

### Step 3: The lineup delta still means you

`tradeDelta` values one roster. In a three-way, the balance panel must keep
showing the effect on **your** lineup only — incoming is assets with
`toRoster === myRosterId`, outgoing is assets with `fromRoster === myRosterId`,
regardless of who the counterparty is.

Do not attempt to show all three teams' deltas. You cannot see other managers'
projections meaningfully and it would triple the panel for no decision value.

**Verify**: build a three-way where you send a bench player and receive nothing.
The balance reads "No change to who starts", not an error.

### Step 4: Say it is all-or-nothing

Add a line under the submit button: all three teams must accept, and nothing
moves if one declines. The engine already enforces this; the UI should say so
before you send.

Show each side's acceptance state after proposing, reusing the `sides` data
`listTrades` already returns.

**Verify**: propose a three-way and confirm all three appear with a waiting
state.

### Step 5: Remove the leftover

```
grep -n "AssetCol" src/routes/league/\$leagueId/trades.tsx
```

If nothing references it, delete the function and any now-unused imports.

**Verify**: the grep returns nothing and `npm run build` exits 0.

## Test plan

- No automated tests: `npm test` runs `node --test 'scripts/**/*.test.mjs'`
  (`package.json`) — build scripts only.
- Manual, with a hosted league of at least three seats:
  1. Add a third team; the roster column tabs and the deal splits into legs.
  2. Every chip shows a destination.
  3. Propose a genuine three-way — A sends to B, B sends to C, C sends to A —
     and confirm it lands with the right owners after all three accept.
  4. Drop the third team; the layout returns to two columns and the deal keeps
     the assets that are still valid.
  5. The balance reflects only your roster.
  6. At 390px the legs stack and nothing scrolls sideways.
- `npm test` stays green.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] Destination pills appear with three teams and are hidden with two
- [ ] A real three-way proposes and applies correctly (manual 3)
- [ ] The balance values only your roster
- [ ] `AssetCol` is gone, or still referenced and deliberately kept (say which)
- [ ] `proposeTrade` is unmodified
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 020 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Dropping the third team leaves assets pointing at a team no longer in the
  deal. They must be removed or retargeted before submit, never sent — the
  server would reject the whole trade with a confusing error.
- A three-way proposes but applies only part of itself. That is an engine bug,
  not a UI bug; stop and report it rather than working around it.
- `AssetCol` turns out to be used by something outside `trades.tsx`.
- You are tempted to support four teams because the loop allows it. Out of
  scope, and the tabbed column does not survive it.

## Maintenance notes

- **The destination pill is the whole feature.** Everything else here is
  arrangement; the pill is what stops people misreading who gets what.
- **The offer card cannot yet render a received three-way well** — plan 018 was
  written for two sides. That is the obvious follow-up and is deliberately not
  bundled in.
- **Partial application is the risk to watch.** All-or-nothing is enforced by
  requiring every side to accept, so a reviewer should confirm the acceptance
  gate rather than trusting the copy.
