# Skin contract

Restyle the desk without forking the engine. One host, one skin, one
installed app named `brand.name` with `start_url=/`.

## Edit these

- `src/skin/brand.ts` — `name`, `shortName`, `tagline`, `kicker`
- `src/skin/tokens.css` — every literal colour, shadow, and accent ramp
- `public/favicon.svg` — tab icon
- `public/og.jpg` — share card (1200×630)

Wordmark and document title read `brand.name`. Tokens here are raw
custom properties (`--paper`, `--ink`, `--brand`, `--caution`, …).
`src/styles.css` maps them onto Tailwind (`bg-bg`, `text-fg`,
`--color-warn`) via `@theme inline`. Do not move that map.

Mode is three-state (`light` / `dark` / `system`) via `data-theme` on
`<html>`. Accent is green unless you stamp `data-accent="blue"` —
that attribute is documented and never applied by default.

After a palette change, keep cream/dark `theme-color` in
`src/routes/__root.tsx` in sync with `--paper`.

## Do not edit

- `src/lib/league/engine.server.ts` and other scoring / seat / waiver
  code
- `src/lib/auth/**` — sign-in is the product, not the skin
- `public/__grok/**`, `scripts/install-page.html`,
  `scripts/grok-pwa-*.mjs`, `server/middleware/grok-pwa.ts`
- The `<PreviewHostBridge />` mount and `grokPwaPlugin()`
- A service worker, a PWA plugin, or the Grok install-tutorial query

`/__grok/manifest.webmanifest` stays in the document head. grok.me
hosts may show the host slug as the PWA name; the in-app wordmark
still comes from `brand.ts`.

## How a friend lands

Invite URL is `/join?code=XXXX`. Unsigned visitors bounce to login
with that URL as `redirect`, then return with the code intact. The
install coach on home / join tells them Share → Add to Home Screen
(iOS) or the browser menu (Android). Never send them to the
Grok install tutorial — that page replaces the app.

## Pull upstream

If you fork only to restyle:

```
git merge -X ours -- src/skin
```

Keep favicon and og.jpg in the same merge ours if they are yours.
