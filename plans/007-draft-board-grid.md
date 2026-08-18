# Plan 007: Draft board grid — every pick visible at once

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9948a37..HEAD -- src/lib/league/engine.server.ts src/routes/league/\$leagueId/draft.tsx src/components/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (independent of 006 — reads no new columns)
- **Category**: direction
- **Planned at**: commit `9948a37`, 2026-08-17

## Why this matters

The draft page today shows the last twelve picks as a list and a scrolling pool
of available players. That tells you what just happened but not what the draft
*is* — you cannot see runs forming, who took which position, or where your next
pick falls. A board grid (rounds down, teams across) is the single screen a
draft is normally read from, and every other draft feature in plans 008–012
hangs off it.

This plan is read-only: no writes, no behaviour change, no new columns. It can
ship on its own and be reverted cleanly.

## Current state

### The route

`src/routes/league/$leagueId/draft.tsx` (206 lines) is a two-column layout:
recent picks and pick stock on the left, available players on the right. It
polls every 4s while live (`draft.tsx:29-33`):

```tsx
const draft = useQuery({
  queryKey: ["draft", leagueId, pos],
  queryFn: () => getDraft({ data: { leagueId, position: pos, query: "" } }),
  refetchInterval: (query) => (query.state.data?.status === "live" ? 4000 : false),
});
```

### The loader

`loadDraft` in `src/lib/league/engine.server.ts:852-936`. Its return type
already includes most of what a board needs, but **not** a full pick list — only
the last twelve (`engine.server.ts:903-909`):

```ts
const recent = picks.filter((p) => p.player_id).slice(-12).reverse().map((p) => ({
  pick: p.pick_no,
  round: p.round,
  rosterId: p.roster_id,
  teamName: names.get(p.roster_id) ?? `Roster ${p.roster_id}`,
  player: p.player_id ? getPlayer(p.player_id) : null
}));
```

`stock` is every pick but carries no player (`engine.server.ts:911-922`):

```ts
const stock = picks.map((p) => {
  const orig = p.original_roster ?? p.roster_id;
  const slot = (p.pick_no - 1) % nTeams + 1;
  return {
    pickNo: p.pick_no,
    round: p.round,
    label: `R${p.round}.${String(slot).padStart(2, "0")}`,
    rosterId: p.roster_id,
    ownerName: names.get(p.roster_id) ?? `Team ${p.roster_id}`,
    via: orig !== p.roster_id ? names.get(orig) ?? null : null,
    used: Boolean(p.player_id)
  };
});
```

Note `via` already exists — a traded pick knows which seat it came from, via
`ff_picks.original_roster`. The board must surface it.

`loadDraft` already loads `picks` (all of them) and `names`, so adding the
player to each row is a mapping change, **not** a new query.

### ⚠ `engine.server.ts` is `@ts-nocheck`

The file begins (`src/lib/league/engine.server.ts:1-2`):

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck — restored from the last good build; public fns below stay typed.
```

**This changes how you verify.** TypeScript will not check anything *inside*
this file. The exported signatures are still honoured by *consumers*, which
creates a specific trap: you can add a field to a function's declared return
type, forget to add it to the returned object, and `npm run typecheck` will pass
while the field is `undefined` at runtime.

So for every field you add to a `loadDraft`-style return:

1. add it to the **type annotation**, and
2. add it to the **returned object**, and
3. grep for both, and
4. confirm it is actually present at runtime in the browser (Network tab → the
   `getDraft` response body) before calling the step done.

Do not treat a green typecheck as proof that an engine change is correct.

### Conventions to match

- **Components** live in `src/components/*.tsx`, one export per concern, with a
  block comment at the top explaining *why* the component exists. Read
  `src/components/matchup-spine.tsx` before writing — it is the closest
  analogue (a dense grid built from tokens) and shows the house style: a
  leading doc comment, `cn()` for conditional classes, tokens never raw colors.
- **Tokens only.** Never a hex value. The palette is defined in
  `src/styles.css` and mapped onto Tailwind names in the `@theme inline` block
  (`src/styles.css:147-190`): `bg-surface`, `bg-raised`, `text-faint`,
  `text-muted`, `border-line`, `text-accent-strong`, `bg-accent`, `text-loss`.
- **Position tinting**: `src/components/avatar.tsx` establishes the pattern of
  deriving shades with `color-mix(in oklab, var(--brand) N%, var(--paper-sunken))`.
  Use the same technique — six steps of one hue — rather than six different
  colors. A board with six hues becomes unreadable.
- Numbers use `font-mono` and `tabular-nums`.

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
- `src/lib/league/engine.server.ts` — extend `loadDraft`'s return with a `board`
  array. Do not change any existing field.
- `src/components/draft-board.tsx` (create)
- `src/routes/league/$leagueId/draft.tsx` — render the board above the existing
  content

**Out of scope** (do NOT touch):
- `makePick`, `claimPick`, `flushHousePicks`, `autoFillDraft` — no write path
  changes in this plan.
- `src/lib/league/fns.ts` — `getDraft`'s validator does not change; the handler
  returns whatever `loadDraft` returns.
- `ff_draft` / `ff_picks` schema — plan 006 owns schema.
- The clock, autodraft, the queue, trading — plans 008–012.
- Removing the existing `recent` list or `stock` list. Leave both. A later plan
  may retire them; doing it here makes this plan unreviewable.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: show the whole draft board`

## Steps

### Step 1: Return the full board from `loadDraft`

In `src/lib/league/engine.server.ts`, add a `board` field to `loadDraft`'s
return type and value. It must be derived from the `picks` and `names` already
in scope — do not add a query.

Add to the return type annotation (alongside `recent`, `available`, `stock`):

```ts
  board: {
    pickNo: number;
    round: number;
    /** 1-based position within the round, after the snake is applied. */
    slot: number;
    label: string;
    rosterId: number;
    teamName: string;
    /** The seat this pick started with, when it was traded. */
    via: string | null;
    player: { name: string; position: string | null } | null;
  }[];
  /** Seats in board order, so the grid can render columns without a second source. */
  seats: { rosterId: number; teamName: string }[];
```

Build it next to `stock` (reuse the same `orig` / `slot` computation):

```ts
const board = picks.map((p) => {
  const orig = p.original_roster ?? p.roster_id;
  const slot = (p.pick_no - 1) % nTeams + 1;
  const player = p.player_id ? getPlayer(p.player_id) : null;
  return {
    pickNo: p.pick_no,
    round: p.round,
    slot,
    label: `${p.round}.${String(slot).padStart(2, "0")}`,
    rosterId: p.roster_id,
    teamName: names.get(p.roster_id) ?? `Team ${p.roster_id}`,
    via: orig !== p.roster_id ? names.get(orig) ?? null : null,
    player: player ? { name: player.full_name, position: player.position } : null,
  };
});
const seats = rosters.map((r) => ({ rosterId: r.roster_id, teamName: r.team_name }));
```

Add `board` and `seats` to the returned object. **Do not remove or rename any
existing field** — `draft.tsx` reads `recent`, `stock`, `available`, `isMyPick`,
`onClockName`, `status`, `pickNo`, `total`, `isCommish`, `locked`.

**Verify**: `npm run typecheck` → exit 0.
`grep -n "board:" src/lib/league/engine.server.ts` → matches inside `loadDraft`.

### Step 2: Build the board component

Create `src/components/draft-board.tsx` exporting `DraftBoard`.

Props: `{ board, seats, onClockPickNo, myRosterId }` — plain data, no queries
inside the component.

Required behaviour:

1. **Grid shape**: one column per seat in `seats` order, one row per round. The
   round number is a narrow left gutter.
2. **Snake mapping**: the pick that belongs in (round `r`, seat index `i`) is
   the one whose `slot` equals `i + 1` on odd rounds and `seats.length - i` on
   even rounds. Compute it from `board` — do **not** assume `board` is sorted by
   seat.
3. **Cell contents**: surname only, then `POS label` beneath. A cell is about
   90px wide; a full name does not fit. Derive the surname by dropping the first
   whitespace-delimited token, but keep the remainder whole when it is short
   (so `A. St. Brown` → `St. Brown`, not `Brown`).
4. **Position tint**: six steps of the brand hue, strongest for QB through
   faintest for D/ST, via `color-mix(in oklab, var(--brand) N%, var(--paper-sunken))`.
5. **Markers**: the on-clock cell gets a ring in `--color-accent-deep`; cells
   belonging to `myRosterId` get a lighter ring; a traded pick shows `←SEAT` in
   `text-accent-strong`.
6. **Layout**: full width of its container, `table-layout: fixed` with explicit
   column widths, wrapped in an `overflow-x-auto` div. Percentage widths inside
   a scroll container resolve against content and collapse the cells — use fixed
   `<col>` widths (~92px per seat).

Include a legend mapping the six tints to position names; without it the tints
are decoration.

**Verify**: `npm run typecheck` → exit 0.
`npx biome check --max-diagnostics=50 src/components/draft-board.tsx` →
no `lint/` findings in that file. (Warnings from other files are pre-existing.)

### Step 3: Render it on the draft page

In `src/routes/league/$leagueId/draft.tsx`, import `DraftBoard` and render it
above the existing two-column grid, inside the same page wrapper. Pass:

```tsx
<DraftBoard
  board={d.board}
  seats={d.seats}
  onClockPickNo={d.pickNo}
  myRosterId={league.data?.myRosterId ?? null}
/>
```

Guard on `draft.data` the same way the existing markup does. Show a
`<Skeleton className="h-64 rounded-xl" />` while loading — matching the existing
skeleton usage in that file.

**Verify**: `npm run build` → exit 0.
Then `npm run dev`, open `http://localhost:8080/league/<a hosted league>/draft`
and confirm: a grid renders, one column per team, and the number of cells equals
`total`. If no hosted league exists in your database, the page will show the
pre-draft state — that is a valid result; note it and move on.

### Step 4: Confirm nothing regressed on the page

The recent-picks list, the pick-stock list, the position filter, the search box,
and the Draft/Start/Fill buttons must all still work exactly as before.

**Verify**: `git diff src/routes/league/\$leagueId/draft.tsx` → the only changes
are the import, the `<DraftBoard />` block, and its skeleton. No deletions.

## Test plan

- No new automated tests. `npm test` runs `node --test 'scripts/**/*.test.mjs'`
  (`package.json`) — it covers build scripts, not React components or the
  engine, and this plan does not stand up a component test harness.
- Manual, in `npm run dev`:
  - Board renders with one column per seat and rounds descending.
  - The cell for `pickNo` is ringed and reads as on the clock.
  - A drafted cell shows a surname and `POS round.slot`.
  - With ten seats at a 1360px window, all ten columns are visible without
    horizontal scrolling; at 390px the board scrolls sideways and the page does
    not.
- `npm test` stays green.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `src/components/draft-board.tsx` exists and exports `DraftBoard`
- [ ] `loadDraft` returns `board` and `seats`; every pre-existing field is
      still present (`grep -n "recent\|stock\|available" src/lib/league/engine.server.ts`
      still matches inside `loadDraft`)
- [ ] `grep -rn "#[0-9a-fA-F]\{6\}" src/components/draft-board.tsx` returns no
      matches (tokens only, no raw hex)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 007 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `loadDraft`'s signature or return shape no longer matches the excerpts above.
- `ff_picks.original_roster` does not exist. It is added at runtime by
  `ensureOpsSchema` (`src/lib/league/ops.server.ts:60`), so it should — if it
  does not, the `via` marker cannot work and the board should ship without it
  rather than guessing.
- The snake mapping does not produce exactly one pick per (round, seat) cell for
  a real league. Report the league size and round count; do not "fix" it by
  sorting `board` differently until the cause is understood — an off-by-one here
  silently attributes picks to the wrong team.
- You find yourself needing to change `makePick` or `claimPick`. This plan is
  read-only.

## Maintenance notes

- **Plans 008–012 all render into this component.** The clock ring (008), the
  autodraft badge (009), and the mock board (012) reuse `DraftBoard` unchanged
  by passing different data. Keep it a pure presentational component with no
  queries and no mutations inside it.
- **`board` is `O(picks)` and picks are `teams × rounds`** — 150 rows for a
  10-team, 15-round league. That is fine to send every 4s. If a league ever runs
  much larger, the poll interval is the thing to revisit, not the payload shape.
- A reviewer should check that no existing field of `loadDraft` was removed —
  `draft.tsx` and any future consumer depend on them, and TypeScript will not
  catch a field removed from both the type and the value at once.
- Deferred deliberately: retiring the `recent` and `stock` lists once the board
  supersedes them. Do that in a follow-up so this diff stays additive.
