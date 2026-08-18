# Plan 003: Shared QueryClient + loaders warm the next sheet

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ae6e12d..HEAD -- src/router.tsx src/routes/__root.tsx src/lib/query-client.ts src/routes/league/\$leagueId.tsx src/routes/league/\$leagueId/index.tsx src/routes/league/\$leagueId/matchups.tsx src/routes/league/\$leagueId/roster.tsx src/routes/league/\$leagueId/standings.tsx src/routes/scores.tsx src/routes/index.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. Known drift vs original `1abb347`
> (already reconciled — do **not** STOP for these):
> - 001 (`e79cfbc`): `src/router.tsx` already has `defaultPreload: "intent"`
>   and `defaultPreloadDelay: 50`. Keep both; add `context` +
>   `defaultPreloadStaleTime: 0`.
> - 002 (`ae6e12d`): `__root.tsx` QueryClient defaults include
>   `placeholderData: keepPreviousData`. Move those defaults into
>   `src/lib/query-client.ts`. Do not drop last-known-paint UI
>   (`data == null && isPending` skeletons, `hasHydrated`, scoresReady).
> - Matchups/standings also fetch `["book"]` / `["claims"]` for wagers.
>   Leave those. Only drop `enabled: Boolean(league.data)` on
>   matchups/team/activity/recap as specified.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-league-tabs-link.md (tabs must be `<Link>` or `defaultPreload` never runs)
- **Category**: perf
- **Planned at**: commit `ae6e12d`, 2026-08-17 (reconciled from `1abb347`; no loaders yet)
- **Landed**: `2f203be` on `main` (not pushed)

## Why this matters

Every league page is a client `useQuery` island. The layout fetches `["league", id]` and children wait (`enabled: Boolean(league.data)`) then fire matchups/team/activity. First visit to a sheet is always: paint bones → RPC → numbers. Hover does nothing for data. This plan puts one `QueryClient` on the router, seeds it from route loaders with the **same query keys the pages already use**, and starts matchups/team without waiting on the full bundle when the week is known. Combined with 001, hovering Matchups starts `ensureQueryData` before the click.

## Current state

Router (`src/router.tsx`) — after 001 it should already have `defaultPreload: "intent"`. It has **no** `context`.

Root (`src/routes/__root.tsx`) — `createRootRoute` (not `createRootRouteWithContext`). `QueryClient` is `useState` inside `RootDocument`. After 002 the defaults include `placeholderData: keepPreviousData`.

No `loader:` / `beforeLoad` / `ensureQueryData` anywhere under `src/`.

Layout (`src/routes/league/$leagueId.tsx:15-17, 60-64`) is chrome only: fetches the bundle, paints the name + tabs, `<Outlet />`. It does not validate `week` on the parent (only some children do).

Home desk (`src/routes/league/$leagueId/index.tsx:35-97`) — 8 queries. `team` / `matchups` / `activity` / `recap` wait on `league.data`. `projections` waits on `roster?.length`.

Matchups (`matchups.tsx:146-150`) — `enabled: Boolean(league.data)` even though `search.week` often already exists.

Scores (`scores.tsx:35-55`) — `getScores` waits on `getPulse()` to fill week/season, but `getScores` / `getLiveWire` already default those server-side (`src/lib/data/fns.ts:18-28, 51-69`).

Query keys already in use (do **not** rename):

| Key | Server fn |
|-----|-----------|
| `["league", leagueId]` | `getLeagueBundle({ data: { leagueId } })` |
| `["matchups", leagueId, week]` | `getMatchups({ data: { leagueId, week } })` |
| `["team", leagueId, rosterId, week]` | `getTeam({ data: { leagueId, rosterId, week } })` |
| `["pulse"]` | `getPulse()` |
| `["scores", season, week, seasonType]` | `getScores({ data: { week, season, seasonType } })` |
| `["my-leagues"]` | `listMyLeagues()` |

Convention: pages keep `useQuery` with those keys. Loaders only `ensureQueryData` so the hook hydrates from cache. Do not switch pages to `useSuspenseQuery` in this plan.

TanStack Start in this repo: `getRouter` is the required named export (`src/router.tsx`). Root is `createRootRoute` today; changing it to `createRootRouteWithContext` is in scope.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `npm run typecheck` | exit 0              |
| Tests     | `npm test`          | all pass            |
| Dev types | `npx tsc --noEmit`  | same as typecheck   |

No new packages.

## Suggested executor toolkit

- TanStack Router “external data fetching” / `ensureQueryData` in loaders. Match keys exactly or you double-fetch.
- If `createRootRouteWithContext` import fails on this version, STOP (see STOP conditions).

## Scope

**In scope**:
- `src/lib/query-client.ts` (create)
- `src/router.tsx`
- `src/routes/__root.tsx`
- `src/routes/league/$leagueId.tsx` (validateSearch + loader; keep existing UI)
- `src/routes/league/$leagueId/index.tsx` (drop `enabled` gates that the loader makes unnecessary)
- `src/routes/league/$leagueId/matchups.tsx` (same)
- `src/routes/league/$leagueId/roster.tsx` (same)
- `src/routes/league/$leagueId/standings.tsx` (same)
- `src/routes/scores.tsx` (loader + stop waiting on pulse)
- `src/routes/league/$leagueId/matchup/$week/$matchupId.tsx` (optional child loader: matchups + both teams once pair ids are known — only if the parent loader does not already have matchups)

**Out of scope**:
- persistQueryClient (004)
- Changing server fns or adding a combined `getLeagueDocument`
- `enabled` gates that wait on a **real missing id** (`rosterId == null`)
- Recap/desk/activity loaders (nice; not required)
- React Query Devtools
- Editing `routeTree.gen.ts` by hand

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: prefetch league sheets in route loaders`

## Steps

### Step 1: One QueryClient factory

Create `src/lib/query-client.ts`:

```ts
import { keepPreviousData, QueryClient } from "@tanstack/react-query";

export type RouterContext = {
  queryClient: QueryClient;
};

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/** Server: new client per request. Browser: one client for the tab. */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
```

If 002 has not landed yet, still include `placeholderData: keepPreviousData` — it is correct and 002’s step 1 becomes a no-op if this file already has it.

**Verify**: file exists; `npm run typecheck` may still fail until step 2 wires it. That is OK.

### Step 2: Put the client on the router and the root

`src/router.tsx`:

```ts
import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { getQueryClient } from "@/lib/query-client";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = getQueryClient();
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultErrorComponent: AppErrorComponent,
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 0,
  });
}
```

`defaultPreloadStaleTime: 0` means a preload always re-runs the loader; `ensureQueryData` + 30s `staleTime` still prevents a duplicate network call when the key is fresh.

`src/routes/__root.tsx`:
- Change `createRootRoute` → `createRootRouteWithContext<RouterContext>()` (import type from `@/lib/query-client`).
- Delete the `useState(() => new QueryClient(…))` block.
- Read the client from the router: `const { queryClient } = Route.useRouteContext();`
- Keep `<QueryClientProvider client={queryClient}>`.

**Verify**: `npm run typecheck` → exit 0. There must be **one** `new QueryClient` call site (`src/lib/query-client.ts`). `rg -n "new QueryClient" src` → only that file.

### Step 3: Parent league loader + shared week search

`src/routes/league/$leagueId.tsx`:

Add `validateSearch` on the **parent** (children already have their own; a parent schema of `{ week?: number; focus?: number }` is enough):

```ts
type LeagueSearch = { week?: number; focus?: number };

export const Route = createFileRoute("/league/$leagueId")({
  validateSearch: (s: Record<string, unknown>): LeagueSearch => ({
    week: s.week != null && Number.isFinite(Number(s.week)) ? Number(s.week) : undefined,
    focus: s.focus != null && Number.isFinite(Number(s.focus)) ? Number(s.focus) : undefined,
  }),
  loader: async ({ context, params, location }) => {
    const bundle = await context.queryClient.ensureQueryData({
      queryKey: ["league", params.leagueId],
      queryFn: () => getLeagueBundle({ data: { leagueId: params.leagueId } }),
    });
    const search = location.search as LeagueSearch;
    const week = search.week ?? bundle.currentWeek ?? 1;
    const jobs: Promise<unknown>[] = [
      context.queryClient.ensureQueryData({
        queryKey: ["matchups", params.leagueId, week],
        queryFn: () => getMatchups({ data: { leagueId: params.leagueId, week } }),
      }),
    ];
    if (bundle.myRosterId != null) {
      jobs.push(
        context.queryClient.ensureQueryData({
          queryKey: ["team", params.leagueId, bundle.myRosterId, week],
          queryFn: () =>
            getTeam({
              data: { leagueId: params.leagueId, rosterId: bundle.myRosterId, week },
            }),
        }),
      );
    }
    await Promise.all(jobs);
    return { week };
  },
  component: LeagueLayout,
});
```

Keep the layout’s `useQuery({ queryKey: ["league", leagueId], … })` — it should now resolve from cache on first paint. Do **not** remove the `refetchInterval` for `scoringLive`.

Import `getMatchups` / `getTeam` from `@/lib/data/fns` next to the existing `getLeagueBundle` import.

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Stop serial `enabled: Boolean(league.data)` when the week is known

On **Home, Matchups, Roster, Standings**:

- Read `week` from `search.week ?? league.data?.currentWeek ?? 1` (parent now validates search).
- `getMatchups` / `getActivity` / `getRecap`: drop `enabled: Boolean(league.data)` when `leagueId` and `week` are already numbers. Fire immediately.
- `getTeam`: keep `enabled: rosterId != null` (the id is unknown until the bundle or persist). Do **not** also require `Boolean(league.data)` if `rosterId` is already a number.
- Home projections: still need player ids. Leave `enabled: Boolean(season) && Boolean(roster?.length)` — that hop is real. Do not invent a new server fn.

Matchup box (`matchup/$week/$matchupId.tsx`): week and matchup id are in the URL. `getMatchups` must **not** wait on the bundle. `homeTeam` / `awayTeam` may still wait on `rawPair` for roster ids (those are on the pair). Optional extra: once `rawPair` is in cache from the parent loader, this is one render, not a waterfall.

**Verify**: `rg -n "enabled: Boolean\\(league.data\\)" src/routes/league` → remaining hits only where the query truly needs a field from the bundle (e.g. `enabled: Boolean(league.data?.hosted)` for trades/claims is OK).

### Step 5: Scores loader — do not wait on pulse

`src/routes/scores.tsx` already has `validateSearch`. Add:

```ts
loader: ({ context, deps }) => {
  const { week, season, kind } = deps;
  const seasonType = kind === "pre" ? 1 : kind === "post" ? 3 : 2;
  return Promise.all([
    context.queryClient.ensureQueryData({
      queryKey: ["pulse"],
      queryFn: () => getPulse(),
    }),
    context.queryClient.ensureQueryData({
      queryKey: ["scores", season, week, seasonType],
      queryFn: () => getScores({ data: { week, season, seasonType } }),
    }),
  ]);
},
```

Wire this with `loaderDeps: ({ search }) => search` (or whatever this TanStack version names the search→loader bridge). If `loaderDeps` is not on `createFileRoute` in this version, call `getScores({ data: {} })` with **no** week/season so the server defaults, and key that result as `["scores", "default"]` **only in the loader**. Pages must keep using the resolved week/season key once pulse returns — STOP and report if you cannot do this without two competing keys. The safe fallback: loader only `ensureQueryData`s `["pulse"]` and `getScores({ data: {} })` stored under `["scores", undefined, undefined, 2]` matching the page’s key when search is empty (`week`/`season` undefined, `seasonType` 2). Look at the page key:

```ts
queryKey: ["scores", season, week, seasonType],
enabled: week != null && season != null,
```

Change the page: **remove `enabled`**. Call `getScores({ data: { week, season, seasonType } })` even when week/season are undefined (server defaults). Keep the same key with possibly-undefined slots so loader and page match.

Same for `getLiveWire`.

**Verify**: `rg -n "enabled: week != null" src/routes/scores.tsx` → no matches. Typecheck clean.

## Test plan

- No new unit test file required. `npm test` must stay green (001’s `scripts/nav-links.test.mjs` still asserts `defaultPreload`).
- `rg -n "ensureQueryData" src/routes/league/\$leagueId.tsx src/routes/scores.tsx` shows loaders.
- If a browser is available: hover Matchups from Home (in-league) and click — header title must not skeleton; matchup cards should appear without a full-page bone state when the loader finished on hover.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0
- [ ] `rg -n "new QueryClient" src` → only `src/lib/query-client.ts`
- [ ] Parent `/league/$leagueId` has a `loader` that `ensureQueryData`s `["league"]` + `["matchups"]` (+ `["team"]` when `myRosterId` is set)
- [ ] `__root.tsx` uses `createRootRouteWithContext` + `Route.useRouteContext().queryClient`
- [ ] Scores no longer `enabled`-gates on pulse
- [ ] No files outside the in-scope list
- [ ] `plans/README.md` 003 → DONE

## STOP conditions

- `createRootRouteWithContext` is not exported from `@tanstack/react-router` in this version — report the export list; do not invent a fake context type.
- Loaders run on the server and `getLeagueBundle` / cookies fail (auth). If the loader throws for signed-out hosted leagues, catch and return; pages already handle `optionalAuthMiddleware`. Do not force-auth the loader.
- You would need to rename query keys to make loaders line up — STOP. Keys are the contract with 002/004.
- `loaderDeps` / search typing requires a major router upgrade — skip the scores search-deps trick and use the undefined-key fallback; do not bump `@tanstack/*`.
- A verification command fails twice.

## Maintenance notes

- 004 attaches persist to `getQueryClient()`’s browser singleton. Do not create a second client in `__root.tsx` later.
- New league pages: add `ensureQueryData` to the **parent** loader if the data is needed on first paint of that tab; keep the page `useQuery` on the same key.
- Reviewer: confirm hovering a tab does not fire a *different* key than the page (especially `week` type: number vs string).
- Child loaders for recap/activity/wire are deferred; parent already warms the three keys that make Home / Matchups / My Team instant.
