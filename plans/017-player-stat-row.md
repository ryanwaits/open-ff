# Plan 017: The player stat row — one component every trade surface is built from

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 304cfb7..HEAD -- src/components/player-cell.tsx src/components/avatar.tsx src/lib/data/fns.ts src/styles.css`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none to build. Its numbers only move week to week once
  plans/015 lands.
- **Category**: direction
- **Planned at**: commit `304cfb7`, 2026-08-17

## Why this matters

The trade desk renders a player as a toggle button containing his name and
position — no picture, no points, no projection, no rank. You cannot judge a
trade from that, so people leave the page to look players up and come back to a
cleared form.

One row component fixes the composer, the offer card and the trade book at once,
and it is the cheapest piece of the whole trade rebuild because every figure on
it is already computed for another page. Build it first; plans 018–021 all
consume it.

## Current state

### What the trade desk renders today

`src/routes/league/$leagueId/trades.tsx`, inside `AssetCol` (~line 407):

```tsx
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        {players.map((p) => (
          <li key={p.player_id}>
            <button
              type="button"
              onClick={() => onPlayer(p.player_id)}
              className={cn(
                "flex min-h-11 w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm",
                selectedPlayers.includes(p.player_id) ? "bg-accent text-accent-fg" : "hover:bg-raised",
```

Its `players` prop is typed
`Array<{ player_id: string; full_name: string; position: string | null }>` —
the component is not even given the data to show more.

### What already exists to build on

**`PlayerCell`** (`src/components/player-cell.tsx:6-40`) already solves
identity: it picks a headshot, swaps to a team logo for D/ST, renames D/ST
properly, and renders `POS · TEAM`.

```tsx
  const isDef = player.position === "DEF";
  const src = isDef
    ? teamLogo(player.team ?? player.player_id)
    : playerHeadshot(player.player_id, player.espn_id);
  const name = isDef && player.team ? `${player.team} D/ST` : player.full_name;
```

**`Avatar`** (`src/components/avatar.tsx:46`) handles the broken-image and
monogram fallback, and takes a `tint` flag.

**Do not reimplement either.** The new row composes `PlayerCell` and adds the
numbers around it.

### Where the numbers come from

- **Projection** — `getProjections` in `src/lib/data/fns.ts`, returning
  `Record<playerId, { points, reason }>`. Already fetched by
  `src/routes/league/$leagueId/index.tsx` and `roster.tsx`; copy the query shape
  from one of them.
- **Per-game, position rank, weekly series** — `getPlayerProfile`
  (`src/lib/data/fns.ts`), returning `perGame`, `posRank`, `posRankOf`,
  `weekly: (number | null)[]`, `byeWeek`. **One call per player is too many for
  a list** — see step 3.
- **Bye** — `getByeWeeks` (`src/lib/data/fns.ts`), a season-wide map already
  fetched on the home page with a 12-hour `staleTime`.
- **Injury** — `RosterPlayer.injury_status`, already on the roster payload.

### Conventions

- Tokens only, never a hex value. Names come from the `@theme inline` block in
  `src/styles.css` (~147-190): `bg-surface`, `bg-raised`, `text-faint`,
  `text-muted`, `border-line`, `text-accent-strong`, `text-loss`,
  `bg-highlight`.
- Numbers get `font-mono` and `tabular-nums`.
- Components carry a leading block comment explaining why they exist. Read
  `src/components/matchup-spine.tsx` for the house style before writing.

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
- `src/components/player-stat-row.tsx` (create)
- `src/lib/data/fns.ts` — a `getRosterStats` batch fn (step 3), **only if** the
  cheap route in that step is not available

**Out of scope** (do NOT touch):
- `src/components/player-cell.tsx` and `src/components/avatar.tsx` — compose
  them, do not modify them. Other pages depend on their current behaviour.
- `src/routes/league/$leagueId/trades.tsx` — plan 019 rebuilds it. This plan
  only creates the component.
- `src/components/draft-trade-drawer.tsx` — that is the **in-draft** trade
  surface from plan 011 and is separate work. It may adopt this row later; do
  not edit it here and do not block on it.
- Any projection logic. Plan 015 owns that.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: add a player row that carries its numbers`

## Steps

### Step 1: The component

Create `src/components/player-stat-row.tsx`:

```tsx
/**
 * A player, with the numbers you need to judge him.
 *
 * The trade desk used to render a name and a position, which is not enough to
 * decide anything — so people left the page to look a player up and came back
 * to a cleared form. Every figure here is already computed for another surface:
 * the projection from getProjections, per-game and rank from the player
 * profile, the weekly shape from its `weekly` series.
 *
 * Presentational only. It fetches nothing; the caller supplies the data.
 */
export type PlayerStatRowData = {
  player: SlimPlayer;
  /** This week, under the league's book. */
  projection?: number | null;
  /** True when `projection` is a season average rather than a forecast. */
  projectionIsAverage?: boolean;
  perGame?: number | null;
  /** e.g. "WR2". */
  posRank?: string | null;
  /** Up to 8 recent weeks; null is a week with no game. */
  weekly?: (number | null)[];
  byeWeek?: number | null;
};

export function PlayerStatRow({
  data,
  selected = false,
  onSelect,
  onPeek,
  dense = false,
}: {
  data: PlayerStatRowData;
  selected?: boolean;
  onSelect?: () => void;
  onPeek?: () => void;
  dense?: boolean;
});
```

Layout, left to right: `PlayerCell` (identity), a sparkline, the projection with
a `PROJ` caption, and a position-rank chip.

Requirements:

- **Sparkline** — last 8 entries of `weekly`, bars scaled to the max in that
  window, a null week drawn in `bg-line-strong` rather than skipped. Roughly
  44×18px. It is decoration for shape, not a chart: no axes, no labels.
- **Rank chip** — highlight with `bg-highlight text-accent-fg` when the rank is
  elite for the position (QB1–6, RB1–9, WR1–9, TE1–5), otherwise
  `bg-raised text-muted`.
- **Bye and injury** ride on the meta line as small pills; injury uses
  `text-loss`. These are the most common reason a trade is a trap and belong
  where the eye already is.
- **`projectionIsAverage`** dims the number and captions it `AVG` instead of
  `PROJ`. Plan 015 adds the `"season-avg"` reason that feeds this; until then
  callers leave it unset. Do not silently present an average as a forecast.
- **Two targets, one row.** `onSelect` fires on the row; `onPeek` fires on the
  avatar and must call `stopPropagation`. If only one handler is given, the
  whole row uses it.
- `dense` drops the sparkline for tight containers.

**Verify**: `npm run typecheck` → exit 0.
`grep -c "#[0-9a-fA-F]\{6\}" src/components/player-stat-row.tsx` → `0`.

### Step 2: Prove it renders

Temporarily render three rows on an existing page — the wire page
(`src/routes/league/$leagueId/wire.tsx`) already has players and projections in
scope — then **revert that edit before committing**.

**Verify**: in `npm run dev`, three rows show an avatar, a sparkline, a
projection and a rank chip, with no console errors. Then
`git diff src/routes/league/$leagueId/wire.tsx` → empty.

### Step 3: Batch the stats

A list of 15 players must not make 15 `getPlayerProfile` calls — that endpoint
loads the season seed and recomputes position ranks per call.

**Try the cheap route first.** `getProjections` already takes an array and
returns a map, and `getByeWeeks` is a single season-wide call. If per-game and
rank can be dropped from the *list* rows and shown only in the peek (plan 019),
no new endpoint is needed — pass `projection`, `weekly` from data the caller
already has, and `byeWeek`.

Only if list rows genuinely need per-game and rank, add one batch fn to
`src/lib/data/fns.ts`:

```ts
export const getRosterStats = createServerFn({ method: "GET" })
  .validator(z.object({ leagueId: z.string(), season: z.string(), playerIds: z.array(z.string()) }))
  .handler(async ({ data }) => { /* one seed load, one rank pass, all players */ });
```

Model the handler on `outlooksFor` in `src/lib/data/projections.server.ts:89`,
which already batches: it fetches the weekly maps **once** and reuses them for
every player, with a comment saying exactly why.

**Verify**: whichever route you take, open the Network tab on a page rendering
15 rows. There must be **no** per-player request. Record which route you chose
and why in your report.

## Test plan

- No component tests. `npm test` runs `node --test 'scripts/**/*.test.mjs'`
  (`package.json`), which globs `scripts/`; there is no component harness and
  this plan does not add one.
- Manual, in `npm run dev`:
  - A D/ST row shows the team logo and reads `SEA D/ST`, not a person's name.
  - A player with a missing headshot shows the monogram, not a broken image.
  - A player with `weekly: []` renders without a sparkline and without
    collapsing the row height.
  - A player on bye shows the pill.
  - At 390px the row does not overflow its container.
- `npm test` stays green.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `src/components/player-stat-row.tsx` exists and exports `PlayerStatRow`
- [ ] It renders `PlayerCell`; neither `player-cell.tsx` nor `avatar.tsx` is
      modified (`git diff` on both is empty)
- [ ] No raw hex colours in the new file
- [ ] No per-player network request for a 15-row list (step 3)
- [ ] The temporary render from step 2 is reverted
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 017 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `PlayerCell` does not accept the props in the excerpt, or no longer handles
  the D/ST logo swap.
- A 15-row list cannot avoid per-player requests without a new endpoint **and**
  the batch handler in step 3 turns out to need more than a thin wrapper over
  `outlooksFor`'s existing batching. Report what it would take.
- The sparkline needs a charting library. It must be plain divs; adding a
  dependency for eight bars is not warranted.
- You are tempted to edit `draft-trade-drawer.tsx` to use this row. That is
  in-draft trading, owned by plan 011 and possibly in flight. Leave it.

## Maintenance notes

- **Plans 018, 019 and 020 all consume this.** Keep it presentational — no
  queries, no mutations inside. The moment it fetches, it stops being reusable
  across the offer card and the composer.
- **Plan 011's in-draft trade drawer is a natural second adopter** once both
  have landed. Separate work, no dependency in either direction; worth revisiting
  as a follow-up so the two trade surfaces look alike.
- **`projectionIsAverage` is the honesty valve.** When plan 015 lands, wire it
  from `Projection.reason === "season-avg"`. Showing a stale average styled as a
  live forecast is the specific failure this guards against.
- A reviewer should check the D/ST case and the missing-headshot case — those
  are where a row component usually breaks, and both are already solved inside
  `PlayerCell` if it is actually being composed rather than reimplemented.
