# Plan 026: Skin contract + scan-to-homescreen

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 553f159..HEAD -- src/styles.css src/lib/theme.ts src/components/shell.tsx src/routes/__root.tsx src/routes/join.tsx src/routes/login.tsx scripts/grok-pwa-shared.mjs`
> On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 025 (product name / README exist)
- **Category**: direction
- **Planned at**: commit `553f159`, 2026-08-17

## Why this matters

Two product goals share one contract:

1. A commish (or their own harness/skill) should restyle the desk without
   forking `engine.server.ts`. Upstream pulls should not wipe a skin.
2. A friend should scan a QR, sign in, take a seat, and put Ledger on the
   home screen — no App Store. It should feel like a small native app.

Today brand lives in `shell.tsx` / `__root.tsx` / `styles.css` literals,
PWA chrome is Grok (`/__grok/manifest`, host-slug name, `#000` theme),
join → login **drops** `?code=`, there is no QR, no service worker, and
`viewport-fit=cover` is missing so `env(safe-area-inset-*)` is 0.

Do **not** unbrand `scripts/install-page.html` (platform). Do **not** put
`?install=1&platform=ios` on invite URLs (that **replaces** the join page).

## Current state

- Tokens already layered correctly in `src/styles.css:14-19` (`:root` →
  `@theme inline` → utilities). `data-accent="blue"` is documented and
  **never stamped**.
- `src/lib/theme.ts` — light/dark/system only; `THEME_KEY = "ledger-theme"`
- `src/components/shell.tsx:56` hardcodes `Ledger`
- `src/routes/__root.tsx:15-47` — `APP_NAME = "Ledger"`; manifest and
  apple-touch-icon are `/__grok/*`; viewport has no `viewport-fit=cover`
- `src/routes/join.tsx:50-58` — unsigned `/join?code=YARD26` redirects to
  `/login?redirect=/join` (code dropped)
- Invite is a faint code in the league header, no share/QR
- `scripts/grok-pwa-shared.mjs:91-114` — manifest name from host slug;
  colors `#000`; one 180 icon
- No service worker, no Web Push, no `beforeinstallprompt`
- Grok install tutorial: `?install=1&platform=ios` only

Decisions locked for this plan:

- **One installed app** named Ledger (or the skin name), `start_url=/`.
  Not a per-league home-screen icon (iOS snapshots title/icon at add-time;
  one origin ≈ one PWA).
- **Host-level skin**, not per-league CSS.
- **No service worker** in this plan (push is a later slice).
- **Keep** `grokPwaPlugin`, `PreviewHostBridge`, `public/__grok/install/**`.

## Commands you will need

| Purpose   | Command             | Expected |
|-----------|---------------------|----------|
| Typecheck | `bun run typecheck` | exit 0   |
| Tests     | `bun test`          | pass     |
| Lint      | `bun run lint`      | exit 0   |

## Scope

**In scope**:
- `src/skin/brand.ts` (create) — `name`, `shortName`, `tagline`, `kicker`
- `src/skin/tokens.css` (create) — move the **literal hex / font / radius**
  blocks from `src/styles.css` here; `styles.css` `@import`s it
- `src/components/shell.tsx` — wordmark from `brand.name`
- `src/routes/__root.tsx` — `APP_NAME` from brand; `viewport-fit=cover`;
  header `theme-color` stays cream/dark (do not switch to `#000`)
- `src/routes/join.tsx` + `src/routes/login.tsx` — preserve `code` across
  the login bounce
- `src/components/invite-card.tsx` (create) — commish card: URL
  `/join?code=`, copy button, `navigator.share` if present. QR: use a
  **pure** already-installed approach. If no QR lib is in `package.json`,
  render the URL + a `https://` link and a monospace code; do **not**
  `npm install` a QR library unless you first run
  `npm view qrcode versions` and add a tiny dependency the repo already
  philosophically accepts. Prefer an inline SVG QR only if you can do it
  in <80 lines without a dep; otherwise skip QR image in this plan.
- `src/components/install-coach.tsx` (create) — in-app sheet: iOS =
  Share → Add to Home Screen; Android = browser menu / install prompt if
  `beforeinstallprompt` fires. Never navigate to `?install=1`.
- `src/styles.css` — `overscroll-behavior-y: none` on `html`; keep
  `pb-[env(safe-area-inset-bottom)]`; add `pt-[env(safe-area-inset-top)]`
  on the sticky header
- `src/skin/SKILL.md` (create) — 40–80 lines a commish harness can load:
  what to edit (`src/skin/*` + `public/favicon.svg` + `public/og.jpg`),
  what never to edit (engine, auth, `__grok/install`, grok plugin)
- Tests: `scripts/join-redirect.test.mjs` (source-string: join redirect
  includes `code`) and/or `src/skin/brand.test.mjs`

**Out of scope**:
- Editing `scripts/install-page.html` / unbranding Grok
- Service worker, VAPID, badges, push
- Per-league appearance columns
- Splitting 900-line routes into view/container
- Replacing the Grok manifest URL if the injector **requires**
  `/__grok/manifest.webmanifest` — if so, leave the link, document that
  grok.me hosts will show the host slug, and put Ledger name in `brand.ts`
  + apple-mobile-web-app-title only
- `npm install` of a heavy QR or PWA plugin

## Git workflow

- Commit: `feat: extract a skin contract and a join-to-homescreen loop`
- Do NOT push

## Steps

### Step 1: Preserve invite code through login

`join.tsx` today:

```ts
navigate({ to: "/login", search: { redirect: "/join" } });
// and
<Navigate to="/login" search={{ redirect: "/join" }} />
```

Change both to

```ts
redirect: code.trim() ? `/join?code=${encodeURIComponent(code.trim())}` : "/join"
```

Login already sends that string to `callbackURL` / `navigate({ to: dest })`
(`login.tsx:20`, dest must start with `/`).

**Verify**: `rg -n 'redirect: "/join"' src/routes/join.tsx` → no match
without `code`. Add `scripts/join-redirect.test.mjs` that reads the file
and asserts `code=` appears next to the login redirect.

### Step 2: Viewport + safe area + overscroll

`__root.tsx` viewport: `width=device-width, initial-scale=1, viewport-fit=cover`.

`shell.tsx` sticky header: add `pt-[env(safe-area-inset-top)]` (and keep
height usable — `min-h-15` + padding, not a clipped `h-15`).

`styles.css`:

```css
html { overscroll-behavior-y: none; }
```

**Verify**: `rg -n "viewport-fit=cover" src/routes/__root.tsx`.
`rg -n "safe-area-inset-top" src/components/shell.tsx`.

### Step 3: `src/skin` contract

1. `src/skin/brand.ts`:

```ts
export const brand = {
  name: "Ledger",
  shortName: "Ledger",
  tagline: "Your league, your desk.",
  kicker: "Hosted here · no other app",
} as const;
```

2. Move `:root` / `[data-theme="dark"]` / `[data-accent="blue"]` **literal**
   custom properties from `styles.css` into `src/skin/tokens.css`.
   `styles.css` starts with:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "./skin/tokens.css";
```

   Wait: `styles.css` lives in `src/`. Import path is `./skin/tokens.css`
   only if you put tokens at `src/skin/tokens.css`. Do that.

3. `shell.tsx` and `__root.tsx` and `login.tsx` wordmark/title read
   `brand.name`. Do not grep-replace every "Ledger" in rules copy.

4. `src/skin/SKILL.md` — the harness doc.

**Verify**: app still typechecks. `rg -n "Ledger" src/components/shell.tsx`
is gone (uses `brand.name`). Visual tokens still resolve (`bg-bg` etc.).

### Step 4: Invite card + install coach

Invite card on settings (commish) and optionally the league header. Props:
`code`, `origin` from `window.location.origin`. Buttons: Copy,
Share (if `navigator.share`).

Install coach: a small component the home or join success path can mount.
Detect iOS via `navigator.userAgent`; Android via `beforeinstallprompt`
listener (store the event, `prompt()` on click). Copy is instructional,
not a fake native prompt.

Do not link to `?install=1&platform=ios`.

**Verify**: `rg -n "install=1" src` → no new hits. Typecheck passes.

## Test plan

- Source-string test for join redirect
- Optional: `brand.name` is imported by `shell.tsx` (read file)
- Pattern: `scripts/query-persist.test.mjs`

## Done criteria

- [ ] `/join?code=X` unsigned → login → back to `/join?code=X`
- [ ] `viewport-fit=cover` + header top safe-area
- [ ] Brand/tokens live under `src/skin/` and `SKILL.md` exists
- [ ] Commish can copy a full join URL
- [ ] In-app install coach exists and does not use Grok `?install=1`
- [ ] `grokPwaPlugin` / `public/__grok` / install-page.html untouched
- [ ] `bun run typecheck` / `bun test` / `bun run lint` pass
- [ ] `plans/README.md` updated

## STOP conditions

- Moving tokens breaks Tailwind `@theme inline` and a 20-minute fix does
  not restore `bg-bg` / `text-fg` — revert the import split, leave
  `brand.ts` + join fix + safe-area, report
- Injector **requires** exact `/__grok/manifest.webmanifest` href — leave
  it, do not fork `grok-pwa-shared.mjs`
- You think you need `vite-plugin-pwa` or a service worker

## Maintenance notes

**Skin skill for a commish harness:** load `src/skin/SKILL.md`, edit only
`src/skin/*`, `public/favicon.svg`, `public/og.jpg`. Pull upstream with
`git merge -X ours -- src/skin` if they fork.

**Push / "you're on the clock":** needs a service worker + VAPID + A2HS.
Separate plan after this loop is used by a real friend. Draft room 4s poll
stays the in-foreground transport (sockets already rejected).

**Per-league icon:** do not. One Ledger icon, home lists seats.

Reviewer: reject edits to Grok install HTML "to make it ours."
