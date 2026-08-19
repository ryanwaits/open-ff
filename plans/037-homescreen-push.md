# Plan 037: Web Push after someone actually installs the PWA

> **Executor instructions**: Follow this plan step by step. If the
> operator has **not** confirmed a friend installed the PWA, STOP at
> step 0. Do not invent a service worker "just in case."
>
> **Drift check (run first)**: `git diff --stat dd9bc53..HEAD -- src/skin src/routes/__root.tsx vite.config.ts public/__grok scripts/grok-pwa-shared.mjs`

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/026-skin-and-homescreen.md (DONE — install
  coach, no SW)
- **Category**: direction
- **Planned at**: commit `dd9bc53`, 2026-08-19

## Why this matters

026 put the league on a home screen (`start_url=/`, one PWA named
open-ff). There is still no service worker and no Web Push. Draft
clock and scores poll every few seconds **while the tab is open**.
A closed phone does not hear "you're on the clock." Push is the
right next transport — **after** we know anyone installed. Shipping
SW+push before that is a cache-invalidation footgun for zero users.

## Current state

- No `navigator.serviceWorker` in app source (026 deferred it).
- `grokPwaPlugin` + `public/__grok/manifest.webmanifest` are
  **platform**. Do not delete or unbrand.
- Draft poll stays the in-room transport even after this plan.
  Push is for *closed* app: on-clock, waiver ran, trade offered.
- One origin ≈ one PWA. No per-league icon.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test` | pass |

## Scope

**In scope** (only after step 0):
- A single service worker registered from the app shell, `start_url=/`
- Web Push subscription stored per user + league
- Server send on: you are on the clock; a trade is waiting; waivers
  processed for your claim
- Settings: opt-in toggle, commish cannot force push on a manager

**Out of scope**:
- Replacing the 4s draft poll while the tab is open
- Unbranding `?install=1` / deleting `grokPwaPlugin`
- Per-league manifests
- Email / SMS
- iOS-specific hacks beyond standard Web Push

## Git workflow

- Branch: current
- Commit: `feat: notify managers on clock, trades, and waivers`
- Do NOT push

## Steps

### Step 0: Confirm install

If the operator has not said a human installed the PWA, **stop**.
Leave this TODO.

### Step 1: SW that does not cache HTML as a trap

Register one SW. Precache nothing that would serve a stale
`index.html` over a new deploy (network-first for documents). Do
not fight the Grok PWA plugin.

**Verify**: `bun run typecheck`. Hard refresh still gets new JS.

### Step 2: Opt-in subscription + three events

Store endpoint + keys on the user. Send only the three events
above. Fail quiet if they denied permission.

**Verify**: a local subscribe round-trip (or a documented dry-run
command) exists. No send on every tick.

## Done criteria

- [ ] Step 0 was actually yes
- [ ] Opt-in push for clock / trade / waiver
- [ ] Draft poll unchanged
- [ ] Platform `__grok` install page untouched
- [ ] `bun run typecheck` pass

## STOP conditions

- No confirmed install — stop (this is the default)
- SW would cache the Grok install page or hide `?install=1`
- You are replacing live scores polling with push

## Maintenance notes

- VAPID keys are server secrets. `.env.example` empty keys only.
- Reviewer: reject a SW that serves stale app shell after deploy.
