# Skin contract

Restyle the desk without forking the engine, and without forking components
per skin. One host, any number of skins, switchable per user at runtime via
a `data-skin` attribute on `<html>` — alongside `data-theme` (light / dark)
and `data-accent`.

## Three layers

1. **Raw values** — `src/skin/tokens.css`. Every literal colour, shadow,
   radius, and font stack is written exactly once here, on `:root` (the
   default skin, "Ledger") plus `[data-theme="dark"]` /
   `prefers-color-scheme` for mode. Never write a literal anywhere else.
2. **`@theme inline`** — `src/styles.css`. Maps Tailwind's utility names
   (`bg-bg`, `text-fg`, `--color-warn`, `--radius-md`, `--font-sans`, …)
   onto the raw token names *by reference* (`var(--paper)`,
   `var(--r-md)`, `var(--font-stack-sans)`), so every utility re-resolves
   at runtime when the attribute on `<html>` changes. Do not move this map,
   and never hardcode a literal here — if a utility isn't wired to a
   token yet, add the indirection, don't shortcut it.
3. **Base + component rules**, which only ever name a token (`bg-bg`,
   `text-fg`, `rounded-md`, …). Components never know which skin is active.

Wordmark and document title read `brand.name` from `src/skin/brand.ts` —
edit that file for naming, `public/favicon.svg` / `public/og.jpg` for
imagery. Those are orthogonal to the token system above.

## Runtime axes on `<html>`

- `data-theme="light|dark"` — three-state via `src/lib/theme.ts`
  (`useTheme`), stamped pre-paint by `NO_FLASH_SCRIPT` to avoid a flash.
- `data-accent="blue"` — optional accent ramp override; absent = green.
- `data-skin="boxscore"` — optional full skin override; absent = Ledger
  (the default, byte-identical to no attribute at all). Same store pattern
  (`useSkin` / `setSkinPref` / `SKIN_KEY = "ledger-skin"`), same pre-paint
  stamping, same "absent means default" convention as accent.

These stack: a skin CSS file and the accent ramp can both apply to the
same page. Skin files are imported after `tokens.css`, so at equal
specificity a skin's token wins over the accent ramp — that's intentional,
not a bug to "fix".

## Authoring a new skin

A skin is one CSS file, nothing else, registering a full contract:

1. Create `src/skin/skins/<name>.css`. Under `[data-skin="<name>"]`,
   redeclare every raw token from `tokens.css`'s light `:root` block:
   surface (`--paper`, `--paper-raised`, `--paper-sunken`, `--band`), ink
   (`--ink`, `--ink-2`, `--ink-3`), structure (`--hairline`,
   `--hairline-strong`), identity (`--brand`, `--brand-deep`,
   `--brand-strong`, `--brand-ink`, `--highlight`), signal (`--alarm`,
   `--caution`), depth (`--lift`, `--lift-hover`, `--press-cast`), shape
   (`--r-xs` … `--r-xl`, `--r-pill`), and type (`--font-stack-display`,
   `--font-stack-sans`, `--font-stack-mono`). Add a dark-mode block the
   same way `tokens.css` does — both
   `@media (prefers-color-scheme: dark) { [data-skin="<name>"]:not([data-theme="light"]) { … } }`
   and `[data-skin="<name>"][data-theme="dark"] { … }`, so a stamped
   preference and a bare OS signal both resolve.
2. Import the file in `src/styles.css`, directly after the
   `./skin/tokens.css` import.
3. Add the pref value to `SkinPref` in `src/lib/theme.ts` and to the
   picker's option list on `/account`.
4. That's it — no component touches a skin name. If a component's
   classnames don't yet route through a token (see layer 2 above), fix
   the indirection in `styles.css`; don't special-case the skin in the
   component.

See `src/skin/skins/boxscore.css` for a worked example, and
`src/skin/skin.test.mjs` for the source-assertion tests that keep a new
skin's contract complete.

## Do not edit

- `src/lib/league/engine.server.ts` and other scoring / seat / waiver
  code
- `src/lib/auth/**` — sign-in is the product, not the skin
- `public/__grok/**`, `scripts/install-page.html`,
  `scripts/grok-pwa-*.mjs`, `server/middleware/grok-pwa.ts`
- The `<PreviewHostBridge />` mount and `grokPwaPlugin()`
- A service worker, a PWA plugin, or the Grok install-tutorial query

`/__grok/manifest.webmanifest` stays in the document head — it is the PWA
install path and is not part of the skin/token system above.

## How a friend lands

Invite URL is `/join?code=XXXX`. Unsigned visitors bounce to login
with that URL as `redirect`, then return with the code intact. The
install coach on home / join tells them Share → Add to Home Screen
(iOS) or the browser menu (Android).
