# Plan 012: Mock draft — the same room with the writes turned off

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9948a37..HEAD -- src/components/draft-board.tsx src/routes/league/\$leagueId/ src/lib/league/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/007 (reuses `DraftBoard`), plans/010 (reuses the queue
  panel). Does not need 008, 009 or 011.
- **Category**: direction
- **Planned at**: commit `9948a37`, 2026-08-17

## Why this matters

A mock draft is how you find out where the board tends to fall from your seat
before it matters. The point is not practice at pressing buttons — it is
watching three runs from seat 8 and noticing who keeps being there at pick 8.

The cheap way to build it is to **not build a second draft screen**: same board,
same available list, same queue, backed by in-memory state instead of the
database. That keeps the two permanently consistent — any later change to the
board renders in both — and needs no schema at all.

## Current state

### What exists to reuse

- `DraftBoard` (`src/components/draft-board.tsx`, from plan 007) is a pure
  presentational component: it takes `{ board, seats, onClockPickNo, myRosterId }`
  and renders. It performs no queries and no mutations.
- The queue panel in `src/routes/league/$leagueId/draft.tsx` (plan 010) reads
  from `d.queue` rather than fetching for itself.
- `loadDraft` returns `available` — the top 80 undrafted players, already scored
  and filtered by position and query (`src/lib/league/engine.server.ts:890-901`):
  ```ts
  	const available = [];
  	for (const row of loadSeasonPpr()) {
  		if (taken.has(row.player_id)) continue;
  		const p = getPlayer(row.player_id);
  		if (!p?.position) continue;
  		if (pos && p.position !== pos && !(p.fantasy_positions ?? []).includes(pos)) continue;
  		// …
  		available.push({ ...p, pts: row.pts_ppr });
  		if (available.length >= 80) break;
  	}
  ```
- `nextAutopick(rosterId, byRoster, ranked, taken)`
  (`engine.server.ts:348-...`) is the bot brain: it counts what a roster has and
  fills needs from a ranked pool. It is a **pure function of its arguments** —
  no database access — which is exactly why it can drive a mock.

### The locked decisions this plan implements

1. **The mock uses the league's scoring book.** Otherwise the board falls
   differently than the real draft and the practice teaches the wrong lesson.
   The league's book is already resolved per league — see `bookOf(row)` usage in
   `engine.server.ts` and `scoringBookFor` in
   `src/lib/data/projections.server.ts`.
2. **Mock history is ephemeral.** Kept in memory while the page is open so "how
   the board fell" works across a few runs in a row, and gone after that. No
   database, no `localStorage`.
3. **No clock.** There is nobody to be fair to.

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
- `src/lib/league/mock-draft.ts` (create) — pure, client-safe simulation
- `src/routes/league/$leagueId/mock.tsx` (create) — the route
- `src/routes/league/$leagueId/draft.tsx` — one link to the mock
- `src/lib/league/fns.ts` — **only** if the mock needs a ranked pool it cannot
  get client-side (see step 1)

**Out of scope** (do NOT touch):
- `ff_draft`, `ff_picks`, `ff_spots`, `ff_queue` — a mock writes **nothing**.
  If you find yourself adding a table or a column, stop.
- `claimPick`, `makePick`, `flushHousePicks`, `autoFillDraft`,
  `expireDraftPicks` — none of them run in a mock.
- `DraftBoard` — reuse it unchanged. If it needs a prop to render mock data,
  that is a signal it was built too specifically; report it rather than forking
  the component.
- Persisting mock results anywhere.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: run a mock draft against bots`

## Steps

### Step 1: The simulation module

Create `src/lib/league/mock-draft.ts`. It must be **pure and client-safe**: no
`getSql`, no `.server` imports, no `node:` imports. It takes a player pool and
returns board state.

```ts
export type MockPlayer = { playerId: string; name: string; position: string | null; team: string | null; pts: number };

export type MockState = {
  seats: { rosterId: number; teamName: string }[];
  /** Index into seats. */
  mySeat: number;
  rounds: number;
  picks: { pickNo: number; round: number; slot: number; rosterId: number; player: MockPlayer | null }[];
  /** 1-based; equals picks.length + 1 when the board is full. */
  onClock: number;
};

export function startMock(input: {
  seats: { rosterId: number; teamName: string }[];
  mySeat: number;
  rounds: number;
}): MockState;

/** Put a player in the current pick and advance. No validation beyond availability. */
export function mockPick(state: MockState, pool: MockPlayer[], playerId: string): MockState;

/** Run bots until it is the viewer's turn again, or the board is full. */
export function runBotsUntilMyTurn(state: MockState, pool: MockPlayer[]): MockState;
```

Bot behaviour must mirror `nextAutopick`'s shape — count what the roster has,
prefer unfilled needs (1 QB, 2 RB, 2 WR, 1 TE before luxury), then best
available by `pts`. Do **not** import `nextAutopick` itself: it lives in
`engine.server.ts`, which is server-only and `@ts-nocheck`. Re-implement the
same rule in ~30 typed lines and say in a comment that it mirrors
`engine.server.ts`'s `nextAutopick`.

Snake ordering: odd rounds left to right, even rounds right to left. The seat
for (round `r`, order `o`) is `o - 1` on odd rounds and `seats.length - o` on
even rounds.

**Verify**: `npm run typecheck` → exit 0.
`grep -c "getSql\|\.server\|node:" src/lib/league/mock-draft.ts` → `0`.

### Step 2: Source the pool with the league's book

The mock needs a ranked pool scored under **this league's** book, not canned
PPR. `loadDraft`'s `available` is capped at 80 and already position-filtered —
too small for a 150-pick board.

Preferred: add a `getMockPool` server fn in `src/lib/league/fns.ts` returning
~250 players scored under the league's book, reusing `scoringBookFor` from
`src/lib/data/projections.server.ts` and the season seed the engine already
loads. Cache it client-side with a long `staleTime` — the pool does not change
during a mock.

If that turns out to require more than a thin wrapper over existing helpers,
**fall back** to calling the existing `getDraft` with `position: "ALL"` and
accepting the 80-player cap for round one only, and note the limitation in the
UI. Do not build a new scoring path.

**Verify**: `npm run typecheck` → exit 0. In `npm run dev`, the pool response
contains more than 80 entries (or the fallback is documented in the UI).

### Step 3: The mock route

Create `src/routes/league/$leagueId/mock.tsx` using `createFileRoute`, matching
the shape of the other league routes (see `draft.tsx` for the pattern). It
holds `MockState` in `useState` and renders:

- A **banner** stating plainly that nothing here touches the league. Use
  `bg-fg text-bg` so it is unmistakably a different mode.
- **Restart**, **Change seat**, and **Skip to my pick** buttons.
- `<DraftBoard board={…} seats={…} onClockPickNo={…} myRosterId={…} />` — mapping
  `MockState.picks` into the same shape plan 007 defined.
- The available list and the queue panel, reusing the same markup as
  `draft.tsx`. Extract shared markup into a component only if it is a clean
  lift; duplicating ~40 lines is acceptable here and safer than refactoring the
  live draft page.
- **How the board fell** — a table of who was still available at the viewer's
  first pick across runs this session, held in a `useRef` array. Ephemeral by
  decision: it resets on reload and that is correct.

There is **no clock** in this route.

**Verify**: `npm run build` → exit 0. Visiting
`/league/<id>/mock` renders a board and "Skip to my pick" advances bots.

### Step 4: One link from the real draft

In `draft.tsx`, add a link to the mock — most useful before the draft opens, so
place it near the pre-draft copy. One `<Link>`; do not restructure the page.

**Verify**: `git diff src/routes/league/\$leagueId/draft.tsx` → only the added
link.

### Step 5: Prove it writes nothing

```
git stash list
```
…is not the check. The real check: run a full mock to completion, then open the
real draft page for the same league.

**Verify**: the real draft's status, `pickNo`, and board are **exactly** as they
were before the mock ran. No player appears on any roster. If anything changed,
that is a STOP condition.

## Test plan

- No new automated tests. `npm test` runs `node --test 'scripts/**/*.test.mjs'`
  (`package.json`) — build scripts only.
- **However**: `mock-draft.ts` is pure and typed, so it is the one piece of this
  feature that *could* be unit tested. If adding `src/lib/league/mock-draft.test.mjs`
  under the existing `node --test` glob is a ten-minute job, do it and cover:
  snake ordering (pick 11 of a 10-team draft belongs to seat 10, pick 12 to seat
  9), and that `mockPick` never places an already-taken player. If it requires
  build tooling changes, skip it and say so.
- Manual, in `npm run dev`:
  1. Start a mock from seat 8, skip to your pick, take someone. Board updates.
  2. Run to completion. Every seat has `rounds` players and nobody is duplicated.
  3. Restart and run again — "how the board fell" shows two runs.
  4. Reload the page — history is empty. This is correct, not a bug.
  5. Open the real draft: unchanged (step 5 above).
- `npm test` stays green.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `src/lib/league/mock-draft.ts` contains no `getSql`, no `.server` import,
      no `node:` import
- [ ] `DraftBoard` is unmodified (`git diff src/components/draft-board.tsx` is
      empty)
- [ ] Running a full mock leaves the real draft byte-identical (manual 5)
- [ ] No new table, column, or migration (`git status` shows nothing in
      `migrations/`)
- [ ] No new npm dependency (`git diff package.json` is empty)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 012 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `DraftBoard` cannot render mock data without being modified. That means plan
  007 built it too specifically; report what is missing rather than forking it.
- The mock writes anything to the database. Stop immediately — this is the one
  invariant of the whole plan.
- Sourcing a book-scored pool needs a new scoring implementation. Use the
  fallback in step 2 instead.
- You are tempted to persist mock history "just in localStorage." The decision
  is ephemeral; if that turns out to be wrong it is a separate plan.
- Bots produce an obviously broken roster (e.g. six quarterbacks). Report the
  needs logic you wrote alongside `nextAutopick`'s so they can be compared.

## Maintenance notes

- **The mock is a consumer, not a fork.** Its value is that it stays correct for
  free as the real board changes. If a future change makes the two diverge, the
  right fix is to push the difference into props, not to copy the component.
- **Bot logic is duplicated on purpose** — `nextAutopick` is server-only and
  `@ts-nocheck`, and importing it client-side is not possible. If the real
  autopick rule changes, this mirror needs the same change; that coupling is
  noted in a comment in `mock-draft.ts` and is the main maintenance cost of this
  plan.
- Deferred deliberately: mocks against other leagues' settings, saved mock
  results, and a "draft grade" at the end. All are additive later.
