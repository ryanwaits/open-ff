# Plan 001: League tabs stay in-app; hover starts the next sheet

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1abb347..HEAD -- src/components/shell.tsx src/router.tsx src/routes/league/\$leagueId.tsx src/routes/index.tsx scripts/nav-links.test.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `1abb347`, 2026-08-17
- **Landed**: `e79cfbc` on `main` (not pushed)

## Why this matters

League chrome (Home / My Team / Matchups / League / Players) is rendered as raw `<a href>`. That is a full document navigation: new `QueryClient` in `__root.tsx`, empty cache, header skeleton + page skeleton, every server function again. The same query keys are already shared across those pages — the cache would make tab switches instant if it survived. This plan makes tabs TanStack `<Link>`s, preserves `?week=`, and turns on intent preload so hover fetches the route module (data prefetch lands in 003).

## Current state

- `src/components/shell.tsx` — app chrome. Non-league nav already uses `<Link>` (logo, Scores, Sign in). League tabs do not.
- `src/routes/league/$leagueId.tsx` — builds tab objects from `TABS` (already has typed `to`) then *stringifies* them to `href`.
- `src/router.tsx` — `createRouter({ routeTree, defaultErrorComponent })` only. No `defaultPreload`.
- `src/routes/index.tsx` — opening a league is `useNavigate()` on a `<button>`, so hover cannot preload.

`src/components/shell.tsx` tab type and desktop tabs:

```ts
export type ShellTab = {
  key: string;
  label: string;
  href: string;
  active: boolean;
  Icon: LucideIcon;
};
```

```tsx
{tabs.map((t) => (
  <a
    key={t.key}
    href={t.href}
    className={cn(
      "shrink-0 rounded-pill px-3.5 py-2 text-sm font-semibold transition-colors duration-150",
      t.active ? "bg-fg text-bg" : "text-muted hover:bg-raised hover:text-fg",
    )}
  >
    {t.label}
  </a>
))}
```

Mobile league tabs at `shell.tsx:124-135` are the same `<a href={t.href}>` pattern.

Layout currently throws away the typed `to` and the week search:

```ts
const tabs = TABS.filter((tab) => show(tab.when)).map((tab) => {
  const href = tab.to.replace("$leagueId", leagueId);
  return {
    key: tab.to,
    label: tab.label,
    href,
    Icon: tab.Icon,
    active: tab.end
      ? pathname === href
      : pathname.startsWith(href) ||
        tab.owns.some((seg) => pathname.startsWith(`/league/${leagueId}${seg}`)),
  };
});
```

`TABS` already has the correct `to` values (`"/league/$leagueId"`, `"/league/$leagueId/roster"`, …). Gear next to the tabs is already a real `<Link to="/league/$leagueId/settings" params={{ leagueId }}>`. Match that.

Convention: TanStack `Link` for every in-app destination. Raw `<a>` only for true external URLs (none in the shell today). Commit style: `feat:` / `refactor:` (see `git log --oneline -15`).

## Commands you will need

| Purpose   | Command                                      | Expected on success        |
|-----------|----------------------------------------------|----------------------------|
| Typecheck | `npm run typecheck`                          | exit 0, no errors          |
| Tests     | `npm test`                                   | all pass, including new    |
| Lint      | `npx eslint src/components/shell.tsx src/router.tsx src/routes/league/\$leagueId.tsx src/routes/index.tsx` | exit 0 |

No new packages. This repo has no `packageManager` field; use npm (`package-lock.json`).

## Suggested executor toolkit

- TanStack Router `Link` + `defaultPreload: "intent"` docs if the `search` prop type fights you: keep `search` as `(prev) => prev` so `?week=` / `?focus=` survive tab clicks.

## Scope

**In scope**:
- `src/components/shell.tsx`
- `src/router.tsx`
- `src/routes/league/$leagueId.tsx`
- `src/routes/index.tsx`
- `scripts/nav-links.test.mjs` (create)

**Out of scope**:
- Route `loader` / `ensureQueryData` (plan 003)
- Persist / QueryClient move (plans 003–004)
- Auth pending chrome (plan 002)
- Replacing other `<a>` tags that are not league tabs (there should be none in shell tabs after this)
- React `<Activity>` keep-alive

## Git workflow

- Stay on the current branch. Do not push, do not open a PR.
- One commit when the plan is done: `feat: keep league tabs in the spa`

## Steps

### Step 1: Widen `ShellTab` and render `<Link>`

In `src/components/shell.tsx`, change the type to carry the route `to` + `params` instead of a string `href`:

```ts
export type ShellTab = {
  key: string;
  label: string;
  to:
    | "/league/$leagueId"
    | "/league/$leagueId/roster"
    | "/league/$leagueId/matchups"
    | "/league/$leagueId/standings"
    | "/league/$leagueId/wire";
  params: { leagueId: string };
  active: boolean;
  Icon: LucideIcon;
};
```

If the `to` union fights `TABS` (extra routes later), a slightly wider `to: ShellTab["to"]` kept in sync with `TABS` is fine — do **not** fall back to `string` + `as any`.

Replace **both** league tab maps (desktop `shell.tsx` ~55–66 and mobile ~124–135) with:

```tsx
<Link
  key={t.key}
  to={t.to}
  params={t.params}
  search={(prev) => prev}
  preload="intent"
  className={/* same classes as the old <a> */}
>
  {/* same children: label on desktop; Icon + label on mobile */}
</Link>
```

`search={(prev) => prev}` is load-bearing: the week picker writes `?week=` on the layout. A raw href drop of search is how week state dies today.

Leave the non-tab chrome (`<Link to="/scores">`, logo, Sign in) as-is.

**Verify**: `rg -n "<a$" -A 3 src/components/shell.tsx` → no league-tab `<a` whose next lines are `key={t.key}` / `href={t.href}`. Logo/Scores/Sign-in stay `<Link>`.

### Step 2: Pass typed `to` + `params` from the layout

In `src/routes/league/$leagueId.tsx`, stop building `href` strings. Map:

```ts
const tabs = TABS.filter((tab) => show(tab.when)).map((tab) => {
  const href = tab.to.replace("$leagueId", leagueId);
  return {
    key: tab.to,
    label: tab.label,
    to: tab.to,
    params: { leagueId },
    Icon: tab.Icon,
    active: tab.end
      ? pathname === href
      : pathname.startsWith(href) ||
        tab.owns.some((seg) => pathname.startsWith(`/league/${leagueId}${seg}`)),
  };
});
```

Keep the `href` *local* only for the `active` pathname check. Do not put it on `ShellTab`.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Intent preload on the router

`src/router.tsx` becomes:

```ts
export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
  });
}
```

Do not add loaders here (003). Do not touch `QueryClient`.

**Verify**: `rg -n "defaultPreload" src/router.tsx` → `defaultPreload: "intent"`.

### Step 4: Home league rows are Links

In `src/routes/index.tsx`, the seat list is a `<button onClick={() => openLeague(...)}>`. Change each row to a `<Link>`:

```tsx
<Link
  to="/league/$leagueId"
  params={{ leagueId: l.leagueId }}
  preload="intent"
  onClick={() =>
    remember({ leagueId: l.leagueId, name: l.name, season: l.season })
  }
  className={/* same classes as the button */}
>
  {/* same inner content */}
</Link>
```

Keep `openLeague` if something else uses it; delete it if the button was the only caller.

**Verify**: `rg -n "openLeague" src/routes/index.tsx` → no remaining `navigate({ to: "/league/$leagueId"` from a button. Typecheck clean.

### Step 5: Characterization test

Create `scripts/nav-links.test.mjs` modeled on `scripts/brand-check.test.mjs` (`node:test` + `assert`):

1. Read `src/components/shell.tsx` as text.
2. Assert it does **not** match `/tabs\.map\(\(t\) => \(\s*<a/`.
3. Assert it contains `preload="intent"` (or `preload={'intent'}`).
4. Read `src/router.tsx` and assert `defaultPreload: "intent"`.
5. Read `src/routes/index.tsx` and assert a league `Link` to `"/league/$leagueId"`.

**Verify**: `npm test` → exit 0, including the new file (the `test` script is `node --test 'scripts/**/*.test.mjs'`).

## Test plan

- New: `scripts/nav-links.test.mjs` as in step 5. Pattern: `scripts/brand-check.test.mjs`.
- Manual (executor, if a browser is available): open a hosted league, click Matchups, confirm the document does **not** do a full reload (React Query cache of `["league", id]` should keep the header title with no skeleton). If no browser, the grep + typecheck + unit test are the gate.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0; `scripts/nav-links.test.mjs` exists and passes
- [ ] `rg -n "href={t.href}" src/components/shell.tsx` returns no matches
- [ ] `rg -n "defaultPreload" src/router.tsx` shows `"intent"`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 is DONE

## STOP conditions

- The excerpts in "Current state" no longer match (tabs already Links, or `ShellTab` was redesigned).
- TanStack `Link` `search={(prev) => prev}` cannot be typed without `any` — try `search={(prev: Record<string, unknown>) => prev}` first; if the router still rejects it, stop and report the error. Do not `as any` the whole `Link`.
- Fixing types appears to require editing `routeTree.gen.ts` by hand — never do that; it is generated.
- A step's verification fails twice.

## Maintenance notes

- Adding a sixth league tab: extend the `ShellTab["to"]` union **and** `TABS`. Do not go back to string hrefs.
- 003 will add loaders; intent preload then also warms `["league"]` / `["matchups"]`. This plan only preloads the JS module and keeps the QueryClient alive.
- Reviewer: confirm mobile *and* desktop tabs changed; confirm `search` is preserved; confirm home rows are Links not buttons.
