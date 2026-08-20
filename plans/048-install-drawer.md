# 048 — Install drawer (dartwords-style A2HS)

**Goal:** replace the quiet `InstallCoach` card with an engagement-triggered
bottom-sheet drawer that teaches Add-to-Home-Screen the way dartwords.com does:
scrim + sheet, app icon front and center, numbered steps with the browser's
actual glyphs inline. PWA install is the primary mobile distribution path —
this is its front door.

**Reference UX** (dartwords.com, iOS Safari): fires after you finish a round —
not on load. Sheet: sparkle mark, "ADD ME TO YOUR HOME SCREEN!", app icon with
emphasis ticks, then `1. Tap (⋯) in the bottom right corner · 2. Tap (share)
Share · 3. Tap (v) View More · 4. Tap (+) Add to Home Screen`. Close X, no
guilt copy.

## Scope

1. **`<InstallDrawer>`** replaces `install-coach.tsx` (keep its detection:
   `standalone()`, `iosSafari()`, `beforeinstallprompt` capture, dismiss key
   `open-ff-a2hs`).
   - Bottom sheet on mobile viewports; hidden ≥ md. Scrim + drawer, skin
     tokens only (works in ledger and boxscore).
   - Content: favicon/app icon large, brand-voice title ("Put the desk on
     your phone"), numbered steps with inline SVG glyph chips.
   - iOS Safari: Share → (scroll / View More) → Add to Home Screen steps,
     drawn glyphs matching current Safari UI. Keep the "Safari only —
     Chrome on iOS cannot pin it" honesty line.
   - Android/Chromium with captured `beforeinstallprompt`: single Install
     button (native prompt), steps hidden.
   - No fake status bar / no screenshot mockups inside the sheet.
2. **Trigger = engagement, not load** (the dartwords insight):
   - fires after a meaningful moment: join success (`/join` redemption),
     first lineup action, or 2nd distinct-day visit — whichever lands first.
   - never in standalone mode; dismiss persists (existing key);
     a permanent low-key "Add to phone" row in league settings + logged-out
     home reopens it manually.
3. **Manifest/middleware untouched**: `/__grok/manifest.webmanifest`,
   `server/middleware/grok-pwa.ts`, `public/__grok/*` keep working as-is on
   any host (self-contained despite the name). Optional later cleanup —
   rename the `grok-pwa` files/paths to self-owned naming — belongs with
   plan 046 self-host work, NOT here. Do not add a service worker (plan 037
   owns that decision).

## QA

- iOS Safari real device: drawer appears after trigger, steps legible, adds
  to home screen, opens standalone at `/`.
- Android Chrome: native prompt path.
- Desktop: never shows; settings row still reachable.
- Both skins, both themes.

## Decisions

1. Trigger (2026-08-19): **join success + 2nd distinct-day visit**, tune later.

## Unresolved

2. iOS steps: current Safari bottom-bar UI (⋯ → Share) vs classic Share-first
   steps vs both variants — **awaiting operator call**. Do not start the iOS
   step copy until answered; everything else in this plan is unblocked.
