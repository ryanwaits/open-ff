# Plan 016: Replacement value — price a trade by what your lineup actually scores

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 304cfb7..HEAD -- src/lib/league/roster.ts src/lib/league/autofill.ts src/lib/league/engine.server.ts src/lib/data/types.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none to build. Its output is only as good as plans/015, so
  ship 015 first if you want the numbers to mean anything.
- **Category**: direction
- **Planned at**: commit `304cfb7`, 2026-08-17

## Why this matters

The obvious way to price a trade — add up the players coming in, subtract the
players going out — is wrong, and wrong in a way that misleads badly.

Trade your QB1 while holding a QB2 and you do not lose the QB1's whole score;
you lose the **gap between him and the backup who now starts**. Trade a receiver
who was not in your lineup and you lose nothing at all. A naive sum says a
21-point quarterback for a 17-point receiver is a 4-point loss. If your backup
quarterback projects 13 and the receiver replaces an 11-point starter, it is
actually a 2-point *gain*.

This plan adds one pure function that answers it correctly, so every trade
surface in 018–021 can show a number that survives scrutiny.

## Current state

### The fill already exists, server-side

`applyLineup` in `src/lib/league/engine.server.ts:208-225` is a greedy
best-first fill and is exactly the right algorithm:

```ts
function applyLineup(spots, slots, pts) {
	const labeled = labeledStartSlots(slots);
	const used = new Set();
	const next = spots.map((s) => ({ ...s, slot: "bench", starter_slot: null }));
	const byPts = [...next].sort((a, b) => (pts.get(b.player_id) ?? 0) - (pts.get(a.player_id) ?? 0));
	for (const { key, label } of labeled) {
		const pick = byPts.find((s) => !used.has(s.player_id) && compatible(getPlayer(s.player_id)?.position, key));
		if (!pick) continue;
		used.add(pick.player_id);
		pick.slot = "starter";
		pick.starter_slot = label;
	}
	return next;
}
```

It is **not exported**, it lives in a `// @ts-nocheck` file, and it takes
database spot rows. None of that suits a client-side trade preview.

### The client-side pieces to build on

`src/lib/league/roster.ts` is a typed, client-safe module with the slot rules:

- `labeledStartSlots(slots)` → `{ key, label }[]` for the starting slots
- `slotAccepts(pos, slot)` → whether a position fits a slot, including the
  FLEX variants (`roster.ts:164-175`)

`src/lib/league/autofill.ts` shows the house pattern for a pure planning helper
(`autofill.ts:22-34`):

```ts
export function planAutoFill(input: {
  players: RosterPlayer[];
  rosterPositions: string[];
  projections: Record<string, Projection>;
  byes?: Record<string, number>;
  week?: number;
}): Swap[] {
  const { players, rosterPositions, projections, byes, week } = input;
  const slots = labeledStartSlots(rosterPositions);
  …
  const proj = (p: RosterPlayer) => projections[p.player_id]?.points ?? 0;
```

**Model the new module on this file**: typed, pure, no I/O, takes projections as
an argument. Note it only touches already-broken slots — it is a repair tool,
not a general optimiser, which is why it cannot be reused here.

### Types

- `RosterPlayer` — `src/lib/data/types.ts:174`
- `Projection` — `src/lib/data/types.ts:370`, `{ points, reason }`

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `npm run typecheck` | exit 0              |
| Tests     | `npm test`          | all pass            |
| Build     | `npm run build`     | exit 0              |

No new packages.

## Scope

**In scope**:
- `src/lib/league/lineup-value.ts` (create)
- `scripts/lineup-value.test.mjs` (create) — see the test plan; this one **is**
  testable in the existing runner

**Out of scope** (do NOT touch):
- `applyLineup` in `engine.server.ts` — leave it. It serves the server-side
  draft and roster paths and takes a different input shape. Duplicating the
  algorithm in a typed client-safe module is deliberate; unifying them would
  mean either exporting from a `@ts-nocheck` file or making this server-only.
- `planAutoFill` — different job (repair broken slots), keep it.
- Any UI. Plans 018–021 consume this.
- Any server function or database access. This module is pure.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: value a trade by the lineup it produces`

## Steps

### Step 1: The module

Create `src/lib/league/lineup-value.ts`:

```ts
import type { Projection, RosterPlayer } from "@/lib/data/types";
import { labeledStartSlots, slotAccepts } from "./roster";

/**
 * What a roster actually scores, and what a trade does to it.
 *
 * Adding up the players in a trade and subtracting the players out is the
 * intuitive comparison and the wrong one: it prices a player at his whole
 * total rather than at the gap to whoever would replace him. Trade a QB1 while
 * holding a QB2 and you lose the difference, not the score. Trade a bench
 * receiver and you lose nothing.
 *
 * So both sides are valued the same way — fill the starting lineup best-first
 * and total it — and the answer is the difference. Mirrors applyLineup() in
 * engine.server.ts, which does the same greedy fill for the server paths.
 */

export type FilledSlot = { slot: string; player: RosterPlayer | null; points: number };

export type LineupValue = {
  slots: FilledSlot[];
  total: number;
};

/** Greedy best-first fill. Highest projection takes the first slot it fits. */
export function fillLineup(
  players: RosterPlayer[],
  rosterPositions: string[],
  projections: Record<string, Projection>,
): LineupValue;

export type TradeDelta = {
  before: LineupValue;
  after: LineupValue;
  /** after.total - before.total, rounded to one decimal. */
  change: number;
  /** Only slots whose occupant changed. An unchanged row is noise. */
  changed: Array<{
    slot: string;
    from: RosterPlayer | null;
    to: RosterPlayer | null;
    delta: number;
  }>;
};

/** What a trade does to one roster. `incoming` may include players from any team. */
export function tradeDelta(input: {
  players: RosterPlayer[];
  rosterPositions: string[];
  projections: Record<string, Projection>;
  outgoingIds: string[];
  incoming: RosterPlayer[];
}): TradeDelta;
```

Implementation rules:

- Sort by projection descending; ties broken by `player_id` so the result is
  **deterministic** — a fill that reorders between renders would make the UI
  flicker and the test flaky.
- A player with no projection entry counts as 0.
- A slot with nobody eligible is `{ player: null, points: 0 }`, not omitted —
  callers need to show an empty slot.
- Round `change` to one decimal at the end, not per slot, or the rows will not
  sum to the total.

**Verify**: `npm run typecheck` → exit 0.
`grep -c "getSql\|\.server\|node:" src/lib/league/lineup-value.ts` → `0`.

### Step 2: Tests

This module is pure and typed, which makes it the rare piece here that fits the
existing runner. `npm test` runs `node --test 'scripts/**/*.test.mjs'`
(`package.json`), so the file goes in `scripts/`.

Create `scripts/lineup-value.test.mjs` covering, at minimum:

1. **The replacement case** — a roster with QB1 (21) and QB2 (13); trading QB1
   for a WR (17) who displaces an 11-point starter yields `change === +2.0`, not
   `-4.0`. This is the case the whole plan exists for.
2. **The bench case** — trading a player who is not in the starting lineup for
   nothing yields `change === 0`.
3. **Determinism** — two players with identical projections produce the same
   fill across repeated calls.
4. **FLEX** — a receiver fills FLEX when the WR slots are taken.
5. **Empty slot** — a roster with no tight end returns a TE slot with
   `player: null`.

Import the module with a relative path from `scripts/`. If `.ts` cannot be
imported by `node --test` in this repo, **STOP and report** rather than
converting the module to `.mjs` — the type safety is the point.

**Verify**: `npm test` → all pass, including 5 new tests.

### Step 3: Confirm it matches the server fill

Sanity-check against `applyLineup`'s behaviour on a real roster, so the two do
not drift in their interpretation of the slot rules:

```
npx vite-node -e "
  const { fillLineup } = await import('./src/lib/league/lineup-value.ts');
  const eng = await import('./src/lib/league/engine.server.ts');
  const t = await eng.loadTeam('<hosted league id>', 1, 8);
  const b = await eng.loadLeagueBundle('<hosted league id>', null, { tick:false });
  const proj = {};
  for (const p of t.players) proj[p.player_id] = { points: p.weekPts ?? 0, reason: null };
  const f = fillLineup(t.players, b.league.roster_positions ?? [], proj);
  console.log(f.slots.map(s => s.slot + ':' + (s.player?.full_name ?? '—')).join('\\n'));
  console.log('total', f.total);
"
```

**Verify**: the filled slots are legal — no quarterback in a WR slot, FLEX holds
an RB/WR/TE, and the slot labels match the league's `roster_positions`. Record
the output in your report.

## Test plan

- **5 new tests** in `scripts/lineup-value.test.mjs`, listed in step 2. There is
  no existing test to model structurally — `scripts/*.test.mjs` currently cover
  build scripts — so use plain `node:test` `describe`/`it` with `node:assert`.
- The step 3 `vite-node` run is the integration check against real data.
- `npm test` must report the new tests passing.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0 **and** reports the 5 new tests
- [ ] `src/lib/league/lineup-value.ts` has no `getSql`, no `.server` import, no
      `node:` import
- [ ] The replacement-case test asserts `+2.0`, proving the naive sum is not
      being computed
- [ ] `applyLineup` in `engine.server.ts` is unmodified
- [ ] `changed` excludes slots whose occupant did not move
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 016 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `node --test` cannot import a `.ts` file. Report it; do not downgrade the
  module to JavaScript to make the test run.
- `slotAccepts` does not exist in `src/lib/league/roster.ts` or its FLEX
  handling differs from the excerpt.
- Your fill disagrees with `applyLineup` on a real roster in step 3 — for
  example putting a different player in FLEX. Report both outputs. A quiet
  disagreement means the trade preview will contradict the lineup board.
- You find yourself needing league data inside the module. It must stay pure;
  the caller supplies projections and roster positions.

## Maintenance notes

- **The algorithm is duplicated on purpose.** `applyLineup` is server-only and
  lives in a `@ts-nocheck` file; this one is typed and client-safe. If the slot
  rules ever change, both need the change — a comment in each should say so.
- **Greedy is not optimal.** Best-first can be beaten in contrived cases by a
  full assignment solve, and real lineup tools use greedy anyway because the
  difference is rare and the explanation cost of a non-obvious fill is high. If
  someone reports a "wrong" lineup, this is the expected answer, not a bug.
- **Its honesty depends on plan 015.** With a flat season average underneath,
  the delta is still correctly *computed* but the inputs do not move week to
  week. Ship 015 first if the numbers are going to be shown to anyone.
- A reviewer should read the replacement-case test first — if that assertion is
  wrong, everything built on this is wrong in the same direction.
