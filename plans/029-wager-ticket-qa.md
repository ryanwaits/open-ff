# Plan 029: Exercise the FAAB wager ticket for real

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b918703..HEAD -- src/components/wager-ticket.tsx src/components/book-panel.tsx src/routes/league/$leagueId/matchups.tsx src/routes/league/$leagueId/settings.tsx scripts/ops-qa.mjs`
> Compare excerpts if those files moved.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (run **after** 027 if you will leave a live ticket
  in a real league; the script should use a throwaway league)
- **Category**: tests
- **Planned at**: commit `b918703`, 2026-08-18
- **Landed**: `dd9bc53` (not pushed; no-price path)
- **Verified**: `dd9bc53` (reconcile 2026-08-19)

## Why this matters

`plans/README.md` has carried this line for weeks: nothing in the FAAB
wagering UI has been exercised by a human. Economics were never proven
in the browser. `WagerTicket` + `LinePanel` are wired
(`matchups.tsx:496-534`). `book-panel.tsx` even handles the dead-line
empty state so a commish can tell "off" from "no price." Nobody has
clicked through.

This plan is a **scripted click**, not a new market. It is the substitute
for a human until one sits down with a signed-in week that has a quote.

## Current state

- `src/components/wager-ticket.tsx` — dialog; `placeWager` on submit;
  stake starts empty; toast on success
- `src/components/book-panel.tsx` `LinePanel` — `onPick` opens the
  ticket. If `!line.live`, it renders "no price" / "Nothing to price
  yet" (preseason / no projections). **That is likely in local preview.**
- `matchups.tsx` mounts `LinePanel` only when
  `wagerBook.data?.enabled` (settings `bettingOn`)
- Settings: `bettingOn` default false; commish toggle + save
- `scripts/ops-qa.mjs` — existing Playwright login → `/new` → league
  walk. Reuse that pattern. Screenshots go under `screenshots/` (repo),
  **not** `/tmp` and not `/workspace/screenshots`
- Local login seed: `src/lib/auth/local-seed.ts` (email/password
  constants). Reference that file. Do **not** copy the password into
  this plan or into README
- package.json has `playwright`. User harnesses may also have
  `~/.bun/bin/agent-browser`. Prefer agent-browser **if that binary
  exists**; otherwise Playwright like `ops-qa.mjs`. Do not add a third
  browser stack

## Commands you will need

| Purpose   | Command                         | Expected |
|-----------|---------------------------------|----------|
| App up    | `curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/` | 0 if already running |
| Script    | `bun scripts/wager-qa.mjs`      | exit 0; writes `screenshots/wager-*.png` |
| Typecheck | `bun run typecheck`             | exit 0   |
| Tests     | `bun test`                      | pass     |

## Scope

**In scope**:
- `scripts/wager-qa.mjs` (create)
- `src/components/wager-ticket.tsx` / `book-panel.tsx` — `data-testid`
  only, so the script can find the stake field and submit without
  scraping copy
- `src/routes/league/$leagueId/settings.tsx` — `data-testid` on the
  betting toggle if the script cannot find it by role/name
- `screenshots/wager-ticket.png` and/or `screenshots/wager-no-price.png`
  produced by the script (gitignore already covers `screenshots/` —
  do not commit PNGs unless the repo already tracks them)

**Out of scope**:
- New wager kinds, vig, mint fix (027)
- Allowlist (028)
- Starting a production deploy
- Committing secrets or the seed password
- `npm install` of another browser

## Git workflow

- Branch: current
- Commit: `test: script a click through the FAAB wager ticket`
- Do NOT push
- Do NOT commit screenshot binaries unless `git ls-files screenshots`
  already tracks that folder

## Steps

### Step 1: Stable hooks

On `WagerTicket` stake input: `data-testid="wager-stake"`.
On submit button: `data-testid="wager-submit"`.
On `LinePanel` live price buttons: `data-testid="wager-price"`.
On the dead-line section: `data-testid="wager-no-price"`.

Do not restyle.

**Verify**: `rg -n "data-testid=\"wager-" src/components`.

### Step 2: Script the walk

`scripts/wager-qa.mjs`:

1. Fail clearly if `http://127.0.0.1:8080/` is down (do not start the
   dev server yourself unless `startup.sh` is the repo's normal way and
   it is already the running contract — prefer "app must be up").
2. Sign in with the local seed from `src/lib/auth/local-seed.ts`
   (import the constants; do not hardcode a second password).
3. Create a **new** league (`/new`) so you do not stake a real one.
4. Settings: turn betting **on**, save.
5. Open `/league/$id/matchups`.
6. **If** `[data-testid=wager-price]` exists: click one that is not
   disabled (do not click a fade of yourself if the button is dead),
   type `1` into `#wager-stake` / testid, submit, wait for the success
   toast or `placed` state. Screenshot `screenshots/wager-ticket.png`.
   Exit 0.
7. **If** only `[data-testid=wager-no-price]`: screenshot
   `screenshots/wager-no-price.png`, print
   `WAGER_QA: line not live (preseason / no projections) — ticket UI
   mounted, no stake placed.` Exit 0. This still counts as exercising
   the enabled book chrome.
8. Any console `pageerror` fails the script.

**Verify**: with the app up, `bun scripts/wager-qa.mjs` exits 0 and
writes one of the two PNGs.

### Step 3: Document how to run it

Add a short "Book" subsection to `README.md` (025 already created it):
enable betting in settings, open matchups, run `bun scripts/wager-qa.mjs`
while `bun run dev` is up. Do not paste the seed password.

**Verify**: `rg -n "wager-qa" README.md`.

## Test plan

- The script **is** the test. Do not add a bun unit test that imports
  Playwright into `src/`.
- Optional: a source-string test that the testids exist (like
  `scripts/join-redirect.test.mjs`).

## Done criteria

- [ ] `data-testid`s exist on ticket + line panel
- [ ] `scripts/wager-qa.mjs` exits 0 against a running app (price **or**
      honest no-price path)
- [ ] Screenshot written under `screenshots/wager-*.png`
- [ ] README mentions the script
- [ ] Seed password is not duplicated in the script or README
- [ ] `bun run typecheck` passes
- [ ] `plans/README.md` updated; the "not clicked by a human" bullet is
      rewritten to point at this script

## STOP conditions

- Port 8080 is down and you cannot start the app the way `README.md`
  describes — stop; do not invent a second port
- Login fails because seed is gone and you would have to disable auth —
  stop
- You are about to place a wager on a league that is not one you just
  created in the script
- LinePanel never renders because `enabled` is false after a successful
  settings save — that is a product bug; stop and report rather than
  clicking hidden DOM

## Maintenance notes

- Preseason will usually take the no-price branch. Re-run in a week
  with projections to get the full stake path. That re-run is the same
  script, not a new plan.
- 027 should land before this script is aimed at a league you care
  about financially.
- Reviewer: reject a committed password and reject PNGs if
  `screenshots/` is gitignored.
