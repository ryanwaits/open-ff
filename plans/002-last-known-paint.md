# Plan 002: Never unmount last-known data; never lie about empty

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e79cfbc..HEAD -- src/routes/__root.tsx src/lib/store.ts src/components/shell.tsx src/routes/index.tsx src/routes/new.tsx src/routes/join.tsx src/routes/import.tsx src/routes/scores.tsx src/routes/league/\$leagueId.tsx src/routes/league/\$leagueId/index.tsx src/routes/league/\$leagueId/roster.tsx src/routes/league/\$leagueId/matchups.tsx src/routes/league/\$leagueId/standings.tsx src/routes/league/\$leagueId/activity.tsx src/routes/league/\$leagueId/recap.tsx src/routes/league/\$leagueId/draft.tsx src/routes/league/\$leagueId/wire.tsx src/routes/league/\$leagueId/team/\$rosterId.tsx src/routes/league/\$leagueId/matchup/\$week/\$matchupId.tsx src/lib/auth/gates.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. Known drift vs original `1abb347`
> (already reconciled — do **not** STOP for these):
> - Plan 001 landed (`e79cfbc`): shell league tabs and home seat rows are
>   `<Link preload="intent">`. Keep that. Do not restore `<a href>` or the
>   `openLeague` button.
> - Later book/wager work added `LinePanel` / `WagerTicket` on matchups,
>   `PurseMeter` on standings, and pending-only claim filters on roster/wire.
>   Leave those features in place. Apply the skeleton/empty rules around them.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (pairs with 001; do not wait on 003)
- **Category**: perf
- **Planned at**: commit `e79cfbc`, 2026-08-17 (reconciled from `1abb347`; flicker bugs unchanged)
- **Landed**: `ae6e12d` on `main` (not pushed)

## Why this matters

Live 12–15s refetches are already fine — `isLoading` is false when data exists, so polls do not wipe the board. The flashes come from three other bugs: (1) a new query key (week / search string) is treated as a first load, (2) disabled queries (`enabled: false`) look like a successful empty result, (3) My Team treats `!team.data` as “no seat”. Spreadsheet feel = last numbers stay on screen until new numbers arrive. Skeleton only when that key has *never* resolved.

## Current state

React Query defaults (`src/routes/__root.tsx:61-67`) — no `placeholderData`:

```ts
new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
}),
```

There is **zero** `placeholderData` / `keepPreviousData` / `initialData` in `src/`.

False empty — My Team (`src/routes/league/$leagueId/roster.tsx:155-179`):

```tsx
if (league.isLoading) { return <Skeletons…>; }
if (!league.data) return null;
if (rosterId == null || !team.data) {
  return (/* “You don't have a seat here” */);
}
```

`team` is `enabled: rosterId != null && Boolean(league.data)`. After the bundle lands, `rosterId` is set and `team.data` is still missing → the empty-seat card flashes, then the roster. Home (`index.tsx:221`) already does this correctly: no-seat only when `rosterId == null`; lineup skeletons while `team.isLoading`.

False empty — Scores (`src/routes/scores.tsx:45-61, 149-158`): `getScores` is `enabled: week != null && season != null` (those come from `getPulse` unless search has them). While disabled, `isLoading` is false and `data` is undefined → **“No games for that week.”**

False empty — Matchups (`src/routes/league/$leagueId/matchups.tsx:146-160, 266-318, 494-496`): `getMatchups` waits on `league.data`. `canReplay = !weekLive` and `weekLive` is derived from `matchups.data`. While data is missing, `canReplay` is true → ReplayBar mounts, then a live week unmounts it. `shown.length === 0` prints “No matchups this week.”

Search-in-key wipe:

- `src/routes/league/$leagueId/wire.tsx:31-34` — `queryKey: ["wire", leagueId, pos, q]` and `wire.isLoading` replaces the list (`:125`).
- `src/routes/league/$leagueId/draft.tsx:29-32` — `queryKey: ["draft", leagueId, pos, q]`, live poll 4s, `draft.isLoading` skeletons both the pick history and the pool (`:104`, `:174`).

Zustand persist flash (`src/lib/store.ts:16-31`): `recent` defaults to demo league `lg_backyard` / “The Backyard”. No `hasHydrated`. `shell.tsx:33-80` reads `recent[0]` for the header chip → returning users paint the demo name, then swap.

Auth pending blanks:

- `src/lib/auth/gates.tsx:20-32` — `SignedIn` is null until a user exists; `SignedOut` is null while `isPending`. Home (`index.tsx:43-58`) therefore shows **no CTAs and no league list** until session resolves.
- `src/routes/new.tsx:45-51`, `join.tsx:58-64`, `import.tsx:288-294` — full-page pulse until session.
- `src/components/shell.tsx:174-194` — mobile third cell is either Join or Sign in; both hidden while pending → grid shift.

Convention: pages already use `useQuery` + `Skeleton` from `@/components/ui/skeleton`. Do not introduce Suspense in this plan. Match Home’s no-seat branch when fixing roster.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `npm run typecheck` | exit 0              |
| Tests     | `npm test`          | all pass            |
| Lint      | `npx eslint src/routes src/lib/store.ts src/components/shell.tsx src/lib/auth/gates.tsx` | exit 0 |

No new packages. `keepPreviousData` is already exported from `@tanstack/react-query@^5.101.0`.

## Scope

**In scope**:
- `src/routes/__root.tsx` (QueryClient defaults only)
- `src/lib/store.ts`
- `src/components/shell.tsx` (header chip + mobile third cell only — if 001 already converted tabs to Link, do not revert that)
- `src/routes/index.tsx`
- `src/routes/new.tsx`, `src/routes/join.tsx`, `src/routes/import.tsx`
- `src/routes/scores.tsx`
- `src/routes/league/$leagueId/index.tsx`
- `src/routes/league/$leagueId/roster.tsx`
- `src/routes/league/$leagueId/matchups.tsx`
- `src/routes/league/$leagueId/standings.tsx`
- `src/routes/league/$leagueId/activity.tsx`
- `src/routes/league/$leagueId/recap.tsx`
- `src/routes/league/$leagueId/draft.tsx`
- `src/routes/league/$leagueId/wire.tsx`
- `src/routes/league/$leagueId/team/$rosterId.tsx`
- `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx`
- `src/lib/auth/gates.tsx` only if a tiny helper is cleaner than inlining; prefer not to change gate semantics globally

**Out of scope**:
- Loaders / QueryClient-on-router (003)
- persistQueryClient (004)
- Server tick / payload size (005)
- Optimistic start/sit
- Changing `getWire` / `getDraft` 80-row server cap
- Fonts

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `fix: keep last-known desk data on screen`

## Steps

### Step 1: Default `placeholderData: keepPreviousData`

In `src/routes/__root.tsx` (and **copy the same default** if 003 has already moved QueryClient construction — if you see `src/lib/query-client.ts`, edit that file instead and leave `__root.tsx` alone):

```ts
import { keepPreviousData, QueryClient, QueryClientProvider } from "@tanstack/react-query";

new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
    },
  },
});
```

This keeps the previous week/filter result visible when the query key changes. Label the week in the existing `WeekPicker` (already in the header) so numbers are not mistaken for the new week.

**Verify**: `rg -n "keepPreviousData" src/routes/__root.tsx src/lib` → a hit on the QueryClient defaults.

### Step 2: Skeleton / empty rules (apply everywhere listed)

Use these exact rules. Do not invent a shared hook unless a file already has a local helper — consistency of the *rule* matters more than a new abstraction.

1. **Skeleton** only when there is no data to show: `query.data == null && (query.isPending || query.isLoading || !query.isFetched)`.
2. **Empty copy** (“No matchups”, “No games”, “You don’t have a seat”) only when the query is **successful** and the value is actually empty. Never when `enabled === false`.
3. **If `data` exists, render it** even when `isFetching`. No full-tree `if (isLoading) return <Skeleton/>` when `data` is already set (placeholder counts as data).

Concrete replacements:

**Roster** (`roster.tsx`): change the second branch to match Home:

```tsx
if (league.data == null && league.isPending) { /* existing skeletons */ }
if (!league.data) return null;
if (rosterId == null) { /* no-seat card — only this case */ }
if (!team.data) { /* lineup skeletons, same as Home index.tsx:267 */ }
```

**Scores** (`scores.tsx:149`): treat “not ready” separately from “empty week”:

```tsx
const scoresReady = q.isFetched && week != null && season != null;
if (!scoresReady && !q.data) { /* existing 8 skeletons */ }
else if (q.data?.games.length) { <ScoreStrip … /> }
else if (scoresReady) { <p>No games for that week.</p> }
else { /* skeletons — disabled query, pulse still loading */ }
```

**Matchups**:
- `canReplay` only when `matchups.isSuccess && !weekLive`. While `!matchups.isSuccess`, render neither ReplayBar nor the live kicker (or only the live kicker if `league.data?.scoringLive`).
- “No matchups this week.” only when `matchups.isSuccess && shown.length === 0`.
- Keep the existing `matchups.isLoading` skeleton **only** when `matchups.data == null` (after step 1, week changes should have placeholder data).

**Home / standings / activity / recap / team / matchup detail**: change every `if (x.isLoading) return <full page skeleton>` to `if (x.data == null && x.isPending)`. If `data` is present, fall through and render. Matchup detail benches (`homeTeam.isLoading || awayTeam.isLoading` at `:355`) — show the last `homeTeam.data` / `awayTeam.data` if present; skeleton only the missing side.

**Verify**: `rg -n "You don't have a seat" -n src/routes/league/\$leagueId/roster.tsx` and confirm the condition no longer includes `!team.data`. `rg -n "No games for that week" -B 12 src/routes/scores.tsx` shows a `isFetched` / `scoresReady` guard.

### Step 3: Drop search text from live query keys

**Wire** (`wire.tsx`):
- `queryKey: ["wire", leagueId, pos]` — **remove `q`**.
- Keep `queryFn` with `query: ""` (full 80 for that position).
- Filter in memory: `const rows = (wire.data ?? []).filter(p => matches(p, q))` where `matches` is case-insensitive on `full_name` / `search_full_name` / `team`.
- `wire.isLoading` skeletons only when `wire.data == null`.

**Draft** (`draft.tsx`):
- Split what you poll vs what you filter. `queryKey: ["draft", leagueId, pos]` (drop `q`). `queryFn` passes `query: ""`.
- Filter `draft.data.available` in memory the same way.
- The pick history / `recent` / on-clock header must render from `draft.data` even while a pos change is fetching (placeholderData covers this). Never skeleton the history on a keystroke.

Do **not** raise the server 80-cap in this plan. If `q` is non-empty and the filtered list is empty, show “No one matches” — do not fire a second RPC.

**Verify**: `rg -n 'queryKey: \\["wire"' src/routes/league/\$leagueId/wire.tsx` → key is `["wire", leagueId, pos]` only. Same for draft: no `q` in the key.

### Step 4: Zustand persist — no demo flash

`src/lib/store.ts`: add a hydration flag. Default `recent` may stay as the demo seed (used when storage is empty). Do not read it in the shell until rehydrate finishes.

Zustand v5 persist — use this shape (do not invent `state.setState`):

```ts
type LeagueStore = {
  recent: SavedLeague[];
  remember: (league: SavedLeague) => void;
  hasHydrated: boolean;
};

export const useLeagueStore = create<LeagueStore>()(
  persist(
    (set, get) => ({
      recent: [
        { leagueId: DEMO_HOSTED_ID, name: DEMO_HOSTED_NAME, season: "2025" },
      ],
      hasHydrated: false,
      remember: (league) => { /* unchanged */ },
    }),
    {
      name: "ledger-leagues",
      partialize: (s) => ({ recent: s.recent }),
      onRehydrateStorage: () => () => {
        useLeagueStore.setState({ hasHydrated: true });
      },
    },
  ),
);
```

`hasHydrated` must stay out of storage (`partialize`). If the installed persist types reject `onRehydrateStorage`, read `node_modules/zustand/middleware/persist.d.ts` and match that signature.

In `src/components/shell.tsx`, the header league chip (`recent[0]`):

```ts
const hasHydrated = useLeagueStore((s) => s.hasHydrated);
const recent = useLeagueStore((s) => s.recent);
const league = hasHydrated ? recent[0] : undefined;
```

Until hydrated, omit the chip (logo still links to `/`). Never paint “The Backyard” over a real desk.

**Verify**: `rg -n "hasHydrated" src/lib/store.ts src/components/shell.tsx` → both files. Typecheck clean.

### Step 5: Auth pending does not blank chrome

**Home** (`index.tsx`): `listMyLeagues` already runs without waiting on the session. Change the SignedIn/SignedOut split to:

- If `seats.length > 0`, show the league list (ignore gates).
- Else if `isPending`, show the existing pulse block (list area only — keep the hero).
- Else if no user, show the current SignedOut CTAs.
- Else (signed in, zero seats), keep the current empty/create path if any; if there isn’t one, the SignedIn block that only had the list is fine.

Use `useCurrentUserState()` on Home for `isPending` / `user` instead of hiding everything behind both gates.

**new / join / import**: do **not** `return <Shell><pulse/></Shell>` while pending. Render the real form, `disabled` on the submit button while `isPending`. Keep `if (!isPending && !user) return <Navigate … />` — the existing comment in `use-current-user.ts` is the law (do not redirect on `user == null` alone).

**Mobile third cell** (`shell.tsx`): while `isPending`, render a reserved placeholder (`<div className="mx-1 min-h-12" />` or a pulse) in that third column so `grid-cols-3` does not jump. Header avatar pulse is already correct.

**Verify**: `rg -n "if \\(isPending\\)" src/routes/new.tsx src/routes/join.tsx src/routes/import.tsx` → those branches no longer return a pulse page (they may still disable submit). `npm run typecheck` exits 0.

## Test plan

- No new test runner. `npm test` must still pass (`scripts/**/*.test.mjs`).
- If 001’s `scripts/nav-links.test.mjs` exists, do not break it (shell still has `Link` / `preload`).
- Characterization (manual, if a browser is available): hard-reload `/scores` — must not flash “No games for that week.” before skeletons/data. Open My Team with a claimed seat — must not flash “You don’t have a seat.”

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0
- [ ] `rg -n "keepPreviousData" src` hits QueryClient defaults
- [ ] Roster no-seat branch does not include `!team.data`
- [ ] Wire/draft query keys do not include the search string `q`
- [ ] `hasHydrated` exists and the shell will not render `recent[0]` before it
- [ ] `new` / `join` / `import` do not replace the form with a pulse page while pending
- [ ] No files outside the in-scope list
- [ ] `plans/README.md` 002 → DONE

## STOP conditions

- `__root.tsx` no longer constructs the QueryClient (003 landed first) — apply the `placeholderData` default in `src/lib/query-client.ts` instead, then continue.
- Zustand persist API on the installed version rejects `onRehydrateStorage` as written — read `node_modules/zustand/middleware/persist.d.ts` and use that signature. Do not remove the demo default without a hydration gate.
- Filtering wire/draft client-side appears to require raising the 80-cap or a new server fn — stop and report; do not change the server in this plan.
- A verification command fails twice.

## Maintenance notes

- 003 will move QueryClient construction. Copy `placeholderData: keepPreviousData` with it.
- 004 persist will restore `data` before first paint for allowlisted keys; these rules still apply (never unmount when `data` exists).
- Reviewer: week change must not blank matchups; live Sunday must not flash ReplayBar; My Team must not flash no-seat for a claimed roster.
- Follow-up (not this plan): if typed search on the wire needs players beyond the top-80 PPR, add a debounced `q` fetch with `placeholderData` of the current list.
