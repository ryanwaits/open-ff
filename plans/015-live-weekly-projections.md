# Plan 015: Live weekly projections — a number that moves during the season

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 304cfb7..HEAD -- src/lib/data/projections.server.ts src/lib/data/player-refresh.server.ts src/lib/league/ops.server.ts src/lib/data/fns.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `304cfb7`, 2026-08-17

## Why this matters

Every forward-looking number in the app — the lineup board's `proj`, the matchup
spread, win probability, the waiver dialog, and the whole trade desk planned in
016–021 — traces back to one function that returns a **flat season average**. A
back scoring 10 a game early and 18 lately projects at 13 in week 3 and 13 in
week 14. It cannot notice form, a new starting job, or a soft schedule.

Sleeper publishes real weekly projections and, critically, returns them as **raw
component stats** rather than a canned PPR total — so they can be scored through
the league's own book exactly like actual weeks are. That makes this a drop-in
replacement rather than a parallel system, and it upgrades six surfaces at once.

## Current state

### The flat average

`src/lib/data/projections.server.ts:56-80`:

```ts
export function perGameUnder(book: ScoringBook, playerId: string): number | null {
  const row = loadSeed().get(playerId);
  if (!row) return null;
  const gp = Number(row.gp ?? 0);
  if (gp <= 0) return null;

  const parts = components(row);
  const hasParts = Object.values(parts).some((v) => v !== 0);
  if (hasParts) return round1(applyBook(book, parts) / gp);
  // Kickers and defences … fall back to the precomputed total for the preset.
```

`loadSeed()` reads the bundled `data/stats-2025.json`. Nothing about it changes
week to week.

### Who consumes it

- `projectPlayers()` (`projections.server.ts:159`) — the lineup board's `proj`,
  via `getProjections` in `src/lib/data/fns.ts`. Used by
  `src/routes/league/$leagueId/index.tsx` and `roster.tsx`.
- `outlooksFor()` (`projections.server.ts:89`) — mean/sd per player, used by
  `winProbability()` through `src/lib/league/book.server.ts` and
  `src/components/matchup-edge.tsx`. It computes a mean from the weekly series
  and falls back to `perGameUnder` when there are fewer than four weeks.

Both already gate on injury status, so this plan does not touch that.

### The endpoint, verified

`GET https://api.sleeper.app/projections/nfl/{season}/{week}?season_type=regular&position[]=QB&order_by=ppr`

Checked against week 8 of 2025 — returns 200. Per position, rows carrying a real
`stats.pts_ppr`:

| position | rows returned | with a projection |
|---|---|---|
| QB | — | 26 |
| RB | 745 | 78 |
| WR | — | 124 |
| TE | — | 73 |

Most rows are bench players with only an ADP field; **only rows with
`stats.pts_ppr` are usable**, and that set is roughly the startable pool.

Shape of one usable row:

```
top level: player_id, player, stats, team, opponent, week, season, season_type, ...
stats:     pts_ppr, pts_half_ppr, pts_std, gp,
           pass_yd, pass_td, rush_yd, rec, rec_yd, rec_td, fum_lost, ...
```

`player_id` is **top level** (not inside `player`) and is Sleeper's id — the same
key `data/players-slim.json` and `ff_spots.player_id` use. It joins directly.

### Why the components matter

`stats` carries the same component keys the app already scores actual weeks
with, so a projection can go through `applyBook()` and a half-PPR league sees a
half-PPR projection. **Do not use `pts_ppr` directly** — that would silently
show a full-PPR number in a league that is not full PPR, which is the exact bug
`perGameUnder` was written to avoid.

### The refresh pattern to copy

`src/lib/data/player-refresh.server.ts` already does this shape for the player
map: an `ensureSchema()`, a `ff_refresh_log` row keyed by name, a
`REFRESH_AFTER_MS` guard, and a call from `tickAllLeagues` in
`src/lib/league/ops.server.ts`. **Read that file before writing this one and
match it.** It also demonstrates the repo's rule that a refresh failure must
never break the caller.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `npm run typecheck` | exit 0              |
| Tests     | `npm test`          | all pass            |
| Build     | `npm run build`     | exit 0              |
| Ad-hoc run| `npx vite-node -e "…"` | prints your output |

No new packages.

## Scope

**In scope**:
- `src/lib/data/projection-feed.server.ts` (create) — fetch, store, read
- `src/lib/data/projections.server.ts` — `projectPlayers` and `outlooksFor`
  prefer the feed, fall back to `perGameUnder`
- `src/lib/league/ops.server.ts` — hang the weekly refresh off `tickAllLeagues`
- `migrations/0009_projections.sql` (create)

**Out of scope** (do NOT touch):
- `perGameUnder` itself — it stays, as the fallback. Do not delete it.
- The injury gating in `projectPlayers` / `outlooksFor`. Already correct.
- `data/stats-2025.json` — the bundled actuals stay the source for history.
- `src/components/matchup-edge.tsx`, the lineup board, the wager quote — they
  read through the two functions above and need no change.
- Rest-of-season projections. Deliberately deferred; see maintenance notes.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: project players from a weekly feed instead of a season average`

## Steps

### Step 1: Storage

Create `migrations/0009_projections.sql`. Highest existing migration is
`0008_draft_clock.sql`; if that is not true, STOP.

```sql
-- Weekly projections, stored as raw component stats so they can be scored
-- under each league's own book (see plans/015).
create table if not exists ff_projections (
  season text not null,
  week int not null,
  player_id text not null,
  stats_json text not null,
  updated_at timestamptz not null default now(),
  primary key (season, week, player_id)
);
```

**Verify**: `ls migrations/` shows the new file; `npm run build` exits 0.

### Step 2: The feed module

Create `src/lib/data/projection-feed.server.ts`, modelled on
`player-refresh.server.ts`.

```ts
const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];
/** Sleeper asks for restraint; a weekly projection does not need hourly polling. */
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

/**
 * Pull one week of projections and store the raw components.
 *
 * Only rows carrying stats.pts_ppr are real projections — the rest of the
 * payload is bench players with nothing but an ADP field. Storing the
 * components rather than pts_ppr is what lets a half-PPR league see a
 * half-PPR number.
 */
export async function refreshProjections(
  season: string,
  week: number,
  opts?: { force?: boolean },
): Promise<{ skipped: boolean; stored: number }>;

/** Component stats by player id for one week, empty when the feed has not run. */
export async function projectionsFor(
  season: string,
  week: number,
  playerIds: string[],
): Promise<Record<string, Record<string, number>>>;
```

Fetch one position at a time:
`https://api.sleeper.app/projections/nfl/${season}/${week}?season_type=regular&position[]=${pos}&order_by=ppr`

For each row: skip unless `row.stats?.pts_ppr != null`; upsert
`(season, week, row.player_id, JSON.stringify(row.stats))`.

`projectionsFor` must **never throw** — wrap in try/catch and return `{}` so a
missing feed degrades to the old behaviour rather than breaking a page. Same
rule `statusOverlay` follows in `player-refresh.server.ts`.

**Verify**: `npm run typecheck` → exit 0. Then:

```
npx vite-node -e "
  const f = await import('./src/lib/data/projection-feed.server.ts');
  console.log(await f.refreshProjections('2025', 8, { force: true }));
  const m = await f.projectionsFor('2025', 8, ['4046']);
  console.log(Object.keys(m).length, JSON.stringify(m['4046'] || {}).slice(0,120));
"
```

Expect `stored` in the low hundreds, and player `4046` to come back with
component keys. Record the numbers in your report.

### Step 3: Score the feed under the league's book

In `projections.server.ts`, add a helper and use it in **both** consumers:

```ts
/**
 * This week's projection under this league's book, or null when the feed has
 * no row for him. Scored from components for the same reason actual weeks are:
 * a canned pts_ppr would be wrong in any league that is not full PPR.
 */
async function feedProjection(
  book: ScoringBook, season: string, week: number, playerId: string,
  feed: Record<string, Record<string, number>>,
): Promise<number | null> {
  const parts = feed[playerId];
  if (!parts) return null;
  return round1(applyBook(book, parts));
}
```

In `projectPlayers`, load the feed **once** for all `input.players` before the
loop (not per player), then prefer it:

```ts
    const fed = feed[p.player_id] ? round1(applyBook(book, feed[p.player_id])) : null;
    const pg = fed ?? perGameUnder(book, p.player_id);
```

In `outlooksFor`, use the feed for `mean` when present, keeping the measured
`sd` from the weekly series (the feed gives a point estimate, not a spread).
When there is no series, keep today's `pg * SPREAD_RATIO` fallback.

**Verify**: `npm run typecheck` → exit 0. Then compare old and new for a real
player:

```
npx vite-node -e "
  const p = await import('./src/lib/data/projections.server.ts');
  const book = await p.scoringBookFor('<a hosted league id>');
  console.log('season avg:', p.perGameUnder(book, '4046'));
  console.log('projected :', (await p.projectPlayers({
    leagueId:'<id>', season:'2025', week:8,
    players:[{ player_id:'4046' }] })));
"
```

The two numbers should **differ**. If they are identical the feed is not being
consulted — that is a STOP condition, not a rounding coincidence.

### Step 4: Refresh weekly from the cron

In `src/lib/league/ops.server.ts`, inside `tickAllLeagues`, alongside the
existing player-status refresh, add a projections refresh for each distinct
`(season, current_week)` across live leagues. Wrap it so a failure cannot stop
the clock:

```ts
  try {
    const { refreshProjections } = await import("@/lib/data/projection-feed.server");
    for (const key of weeksInPlay) await refreshProjections(key.season, key.week);
  } catch {
    /* a stale projection is better than a stopped clock */
  }
```

**Verify**: `grep -n "refreshProjections" src/lib/league/ops.server.ts` → one
call. `npm run build` → exit 0.

### Step 5: Label the fallback honestly

`Projection` is `{ points: number; reason: "bye" | "out" | "no-data" | null }`
(`src/lib/data/types.ts:370`). Add `"season-avg"` to `reason` and set it when
the number came from `perGameUnder` rather than the feed.

Do **not** change any UI in this plan — just make the distinction available.
Surfacing it is a one-line change later, and mixing a forecast with an average
silently is how a trade tool starts lying.

**Verify**: `grep -n "season-avg" src/lib/data/types.ts src/lib/data/projections.server.ts`
→ matches in both. `npm run typecheck` → exit 0.

## Test plan

- No new automated tests: `npm test` runs `node --test 'scripts/**/*.test.mjs'`
  (`package.json`), which globs `scripts/`, not `src/`. This plan does not add a
  harness.
- The step 2 and step 3 `vite-node` runs **are** the verification. Record both
  outputs in your report, including the two differing numbers from step 3.
- Manual: open a league's My Team page. The `proj` figures should differ from
  the season averages shown before this change, and no player should show a
  blank or `NaN`.
- `npm test` stays green.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `migrations/0009_projections.sql` exists; no earlier migration edited
- [ ] `refreshProjections` stores only rows with `pts_ppr` and stores **components**,
      not the pre-scored total (`grep -n "pts_ppr" src/lib/data/projection-feed.server.ts`
      shows it used only as a filter)
- [ ] `applyBook` is what turns a projection into points
      (`grep -n "applyBook" src/lib/data/projections.server.ts` matches in the feed path)
- [ ] `perGameUnder` still exists and is still called as the fallback
- [ ] Step 3's two numbers differ for a real player
- [ ] `projectionsFor` cannot throw (wrapped in try/catch, returns `{}`)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 015 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The Sleeper endpoint returns non-200, or returns zero rows with `pts_ppr` for
  a week that has already been played. Report the status and a sample row. Do
  **not** fall back to scraping another site.
- `player_id` is no longer top level on the row, or no longer matches
  `ff_spots.player_id`. The whole plan depends on that join.
- Step 3's before/after numbers are identical. The feed is not wired in; find out
  why rather than shipping a no-op.
- Scoring the feed with `applyBook` produces obviously wrong values (a
  quarterback at 3 points, a kicker at 40). Report a sample `stats` object — it
  probably means a component key differs from the actual-stats shape.
- You are tempted to store `pts_ppr` "because it is simpler." That reintroduces
  the wrong-scoring bug for every non-PPR league.

## Maintenance notes

- **This is the highest-leverage single change in the app.** Six surfaces read
  through `projectPlayers` / `outlooksFor`, so getting the number right here is
  worth more than any individual UI plan.
- **Rest of season is a separate question and deliberately not solved here.** A
  weekly projection is not a season value, and a trade is usually about the
  latter. The cheap version — weekly × games remaining, minus byes the app
  already derives — belongs in its own plan so it can be labelled as an estimate
  rather than quietly blended in.
- **`sd` still comes from measured history,** not the feed. Sleeper gives a
  point estimate; win probability needs a spread. If the feed ever exposes a
  range, that is the place to revisit.
- A reviewer should check exactly two things: that components (not `pts_ppr`)
  are what get scored, and that a player missing from the feed still gets a
  number.
