# Plan 004: Persist the workbook across refresh

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2f203be..HEAD -- src/lib/query-client.ts src/lib/query-persist.ts src/router.tsx src/routes/__root.tsx package.json package-lock.json scripts/query-persist.test.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. Known drift vs original `1abb347`
> (already reconciled — do **not** STOP for these):
> - 003 (`2f203be`) created `src/lib/query-client.ts` and moved QueryClient
>   off `__root.tsx`. That is the dependency. Attach persist there.
> - Optional: you may add `"book"` and `"desk"` to `PERSIST_ROOTS` (workbook
>   keys added after the audit). Do not add `pulse` / `scores` / `game` /
>   `outlooks` / `week-stats`.
> - Optional one-liner: `src/lib/auth/client.ts` `signOut` (~line 204) may
>   call `getQueryClient().clear()`. Skip if it is more than one line.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/003-warm-next-sheet.md (`src/lib/query-client.ts` + router-owned client)
- **Category**: perf
- **Planned at**: commit `2f203be`, 2026-08-17 (reconciled; 003 QueryClient is in place)
- **Landed**: `9948a37` on `main` (not pushed)

## Why this matters

Hard refresh (and the old full-document tab click, if 001 is not done) constructs an empty `QueryClient`. First paint is chrome + skeletons even when the user was just looking at that league. Persist the **workbook** keys to `localStorage` so reload paints last-known standings / slate / my roster immediately, then quietly refetches. Do **not** persist live scoreboards — Sunday would lie from disk. SSR dehydrate is explicitly out: `myRosterId` is per-session and must not land in public HTML.

## Current state

After 003, `src/lib/query-client.ts` owns a browser singleton `QueryClient` (`getQueryClient`) with `staleTime: 30_000` and `placeholderData: keepPreviousData`. `__root.tsx` must **not** construct a second client.

`src/lib/store.ts` persists only `{ leagueId, name, season }[]` under `ledger-leagues`. That is names for the header chip, not workbook data.

No `persistQueryClient`, no `dehydrate`, no `HydrationBoundary` in the repo.

Query key roots in use (from the audit; confirm with `rg -n "queryKey:" src` if this drifted):

**Persist (workbook — slowly changing, OK to show stale then refresh):**
`league`, `matchups`, `team`, `my-leagues`, `byes`, `activity`, `recap`, `trades`, `claims`, `picks`, `settings`, `schedule`, `player-profile`

**Do not persist (live / search / session-volatile):**
`pulse`, `scores`, `live-wire`, `week-stats`, `draft`, `wire`, `projections` (injury/line movement), invite previews

`@tanstack/react-query` is `^5.101.0` in `package.json`. Persist packages at the same line: `@tanstack/react-query-persist-client@5.101.4` and `@tanstack/query-sync-storage-persister@5.101.4` (verified on npm at plan time).

This repo has no `packageManager` field; use npm. Check `package.json` before install. Prefer already-installed packages; these two are new and required.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Versions  | `npm view @tanstack/react-query-persist-client version` and `npm view @tanstack/query-sync-storage-persister version` | print a 5.x version; install that exact version if 5.101.4 is gone |
| Install   | `npm install @tanstack/react-query-persist-client@5.101.4 @tanstack/query-sync-storage-persister@5.101.4` | both added next to `@tanstack/react-query` |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests     | `npm test` | all pass, including new persist test |

Do **not** add IndexedDB / `idb-keyval` in this plan. Sync localStorage is enough for the allowlisted JSON.

## Scope

**In scope**:
- `src/lib/query-persist.ts` (create) — allowlist + `shouldPersistQuery`
- `src/lib/query-client.ts` — attach persister on the browser singleton only
- `scripts/query-persist.test.mjs` (create)
- `package.json` / `package-lock.json` (the two persist packages)

**Out of scope**:
- SSR dehydrate / `HydrationBoundary`
- Persisting `scores` / `pulse` / `week-stats` / `draft`
- Changing query keys
- Service worker / AppCache
- Encrypting the cache
- Raising `staleTime` above 5 minutes without a comment

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: persist the league workbook across refresh`

## Steps

### Step 1: Install matching persist packages

Run the `npm view` commands in the table. If latest 5.x is still 5.101.4, install that. If it moved (e.g. 5.102.x), install the latest 5.x that matches the **minor family** of the installed `@tanstack/react-query` (`npm ls @tanstack/react-query`). Do not jump to v6.

**Verify**: `npm ls @tanstack/react-query-persist-client @tanstack/query-sync-storage-persister` → both installed, no `INVALID`.

### Step 2: Allowlist module

Create `src/lib/query-persist.ts`:

```ts
/** Query key[0] values written to localStorage. Live feeds stay memory-only. */
export const PERSIST_ROOTS = new Set<string>([
  "league",
  "matchups",
  "team",
  "my-leagues",
  "byes",
  "activity",
  "recap",
  "trades",
  "claims",
  "picks",
  "settings",
  "schedule",
  "player-profile",
]);

export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const PERSIST_BUSTER = "ledger-workbook-1";
export const PERSIST_STORAGE_KEY = "ledger-rq";

export function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return typeof root === "string" && PERSIST_ROOTS.has(root);
}
```

Bump `PERSIST_BUSTER` when a persisted payload shape changes (e.g. `LeagueBundle` fields). Old caches then miss instead of hydrating garbage.

**Verify**: file exists; `PERSIST_ROOTS` does not contain `pulse`, `scores`, `live-wire`, `week-stats`, `draft`, `wire`.

### Step 3: Attach persist to the browser client only

In `src/lib/query-client.ts`, after creating the browser singleton and **only** when `typeof window !== "undefined"`:

```ts
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  PERSIST_BUSTER,
  PERSIST_MAX_AGE_MS,
  PERSIST_STORAGE_KEY,
  shouldPersistQueryKey,
} from "./query-persist";

// inside getQueryClient(), browser branch, first time only:
const client = makeQueryClient();
persistQueryClient({
  queryClient: client,
  persister: createSyncStoragePersister({
    storage: window.localStorage,
    key: PERSIST_STORAGE_KEY,
  }),
  maxAge: PERSIST_MAX_AGE_MS,
  buster: PERSIST_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: (q) =>
      q.state.status === "success" && shouldPersistQueryKey(q.queryKey),
  },
});
browserClient = client;
return client;
```

Rules:
- Never call `persistQueryClient` on the server branch.
- Never persist error/pending queries.
- Do not persist `myRosterId` through a *side* channel. It already lives on `["league", id]`. On sign-out, the next `getLeagueBundle` (optional auth) will rewrite that field; 30s staleTime will refetch. Also: on sign-out, `queryClient.clear()` if a sign-out handler already exists — if you find `signOut` in `src/lib/auth`, add `getQueryClient().clear()` there **only if** that is a one-line change in an already-open auth helper. If it requires rewriting the auth client, skip and note it in the plan status (do not expand scope).

Optionally raise workbook `staleTime` to `2 * 60_000` **inside the persist shouldDehydrate set only** — not globally. If that is awkward, leave the 30s default; 002 already keeps last-known on screen during the refetch.

**Verify**: `rg -n "persistQueryClient" src/lib/query-client.ts` → only the `window` branch. `npm run typecheck` exits 0.

### Step 4: Characterization test

Create `scripts/query-persist.test.mjs` (pattern: `scripts/brand-check.test.mjs`). Because the helper is TypeScript, **duplicate the allowlist contract in the test by reading the source text** (do not start a TS test runner):

1. Read `src/lib/query-persist.ts` as utf8.
2. Assert the file contains each required persist root as a quoted string: `league`, `matchups`, `team`, `my-leagues`.
3. Assert it does **not** contain `"scores"`, `"pulse"`, `"live-wire"`, `"week-stats"`, `"draft"` inside `PERSIST_ROOTS`. Easiest: parse the `PERSIST_ROOTS = new Set<string>([...])` block with a regex and check membership.
4. Read `src/lib/query-client.ts` and assert `typeof window !== "undefined"` appears before `persistQueryClient` (source order).
5. Assert `PERSIST_BUSTER` is a non-empty string.

**Verify**: `npm test` → exit 0, new file included.

## Test plan

- New: `scripts/query-persist.test.mjs` as above.
- Manual if a browser is available: open a league Home, wait for numbers, hard reload. Header title + standings/lineup must paint from cache before the network returns. Then change week on Matchups, reload, confirm the persisted week slate appears (or current week — either is OK as long as it is not a full-page skeleton). Open `/scores` during a live slate, reload: **do not** expect cached live scores (they must come from the network).

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0 including `scripts/query-persist.test.mjs`
- [ ] `package.json` lists both persist packages at 5.x matching react-query
- [ ] Persist runs only in the browser singleton
- [ ] Allowlist excludes live keys listed above
- [ ] No files outside the in-scope list (auth `clear()` exception documented if used)
- [ ] `plans/README.md` 004 → DONE

## STOP conditions

- 003 has not landed (`src/lib/query-client.ts` missing, or `__root.tsx` still `new QueryClient`) — do not persist a React-state client; report that 003 must go first.
- Persist package APIs do not include `persistQueryClient` / `createSyncStoragePersister` at the installed 5.x — read the package README in `node_modules` and report. Do not switch to a different storage backend.
- Restoring cache throws because a query fn is missing after reload (persist restores *data*, not fns; `useQuery` must still provide `queryFn`). If you see that, you attached persist wrong — do not persist query functions.
- You believe you need IndexedDB because payloads are huge — STOP and report measured key sizes; do not add `idb-keyval` in this plan.
- A verification command fails twice.

## Maintenance notes

- When `LeagueBundle` / `MatchupPair` / `TeamBundle` gain or rename fields, bump `PERSIST_BUSTER`.
- Adding a new workbook query: put its `queryKey[0]` in `PERSIST_ROOTS` and extend the test’s expected list.
- Reviewer: confirm live keys cannot land in `localStorage` (DevTools → Application → `ledger-rq`). Confirm sign-out does not leave another user’s `myRosterId` painted for more than one stale refetch.
- Follow-up: SSR dehydrate for logged-out marketing pages only — never the hosted bundle.
