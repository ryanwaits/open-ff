# Plan 028: Invite-only desk — allowlist emails and member reads

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b918703..HEAD -- src/lib/league/engine.server.ts src/lib/league/fns.ts src/lib/data/fns.ts src/lib/auth/middleware.ts src/routes/join.tsx src/routes/league/$leagueId/settings.tsx`
> Compare excerpts if those files moved.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/023-close-public-clock.md (DONE — invite hidden from
  non-commish; reads still public)
- **Category**: security
- **Planned at**: commit `b918703`, 2026-08-18

## Why this matters

The operator wants **invite-only**. Today:

1. Join needs the code (good).
2. `claimRoster(leagueId, rosterId)` needs only a signed-in user and an
   open seat — no code.
3. Anyone with `/league/lg_…` can read the desk, lineups, trades, and
   book (`getLeagueBundle` / `getMatchups` / `getDesk` use optional or
   no auth).

023 hid the invite code from public JSON. It did not close the URL.

This plan adds two doors, both optional-until-used:

- **Allowlist**: if the commish seeds emails, join/claim must match.
  Empty allowlist = code-only, same as today.
- **Member reads**: hosted league GETs require commish or a seat.
  `/join` + `previewInvite` stay public so the code still works.

## Current state

```ts
// engine.server.ts:843-865 joinLeague
const league = ... invite_code = code ...
// takes first open seat; no email check
update ff_rosters set owner_id = ${userId} ...
```

```ts
// engine.server.ts:2074-2084 claimRoster
// no invite code; any signed-in user who knows leagueId + rosterId
```

```ts
// data/fns.ts:110-117 getLeagueBundle
.middleware([optionalAuthMiddleware])
// hosted: loadLeagueBundle(leagueId, userId) — no membership throw
```

Auth middleware exposes **`userId` only**, not email
(`src/lib/auth/middleware.ts`). Look email up from Better Auth's
`"user"` table (`migrations/0001_auth.sql:19-23` — columns `id`,
`email`). `select email from "user" where id = ${userId}`. Do not
invent a second identity store.

`src/lib/agent/catalog.ts` already lists `joinLeague` / `claimRoster` /
`getSettings`. Add allowlist verbs to the catalog in the same change
(024 parity: new fn → catalog row).

## Commands you will need

| Purpose   | Command                | Expected |
|-----------|------------------------|----------|
| Typecheck | `bun run typecheck`    | exit 0   |
| Tests     | `bun test`             | pass     |
| Lint      | `bunx biome check` on your files | exit 0 |

## Scope

**In scope**:
- `migrations/0011_allowlist.sql` — `ff_allowlist (league_id, email)`
  unique. **0010 is taken** (`0010_player_news.sql`).
- `src/lib/league/engine.server.ts` — allowlist helpers; check on
  `joinLeague` / `claimRoster`; `assertLeagueViewer` for reads
- `src/lib/league/fns.ts` — `listAllowlist`, `addAllowlistEmail`,
  `removeAllowlistEmail`; `claimRoster` accepts optional `code`
- `src/lib/data/fns.ts` — hosted branch of `getLeagueBundle` (and any
  other hosted GET you touch) calls `assertLeagueViewer`
- Hosted reads already in `league/fns.ts` (`getDesk`, `getDraft`,
  `getSettings`, `getBook`, `getTrades`, `getSchedule`, `getClaims`,
  `getEvents`, `getLeagueFacts`) — require viewer
- `src/routes/league/$leagueId/settings.tsx` — commish can add/remove
  emails
- `src/lib/agent/catalog.ts` + `CATALOG.md` — new rows
- `src/lib/league/allowlist.test.mjs` — normalize + match helpers
  (pure; no DB)

**Out of scope**:
- Gating Sleeper-imported public `getMatchups` for non-`lg_` ids
- Magic-link email send (store the list; do not mail)
- Changing invite code format
- FAAB mint (027), wager ticket QA (029)
- Rewriting `auth/server.ts`

## Git workflow

- Branch: current
- Commit: `feat: allowlist emails and require a seat to read a league`
- Do NOT push

## Steps

### Step 1: Pure email match + table

`src/lib/league/allowlist.ts`:

```ts
export function normEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
export function emailAllowed(allow: string[], email: string | null): boolean {
  if (allow.length === 0) return true; // code-only
  if (!email) return false;
  return allow.includes(normEmail(email));
}
```

Migration: `ff_allowlist (league_id text, email text, primary key (league_id, email))`.

Also add the same `create table if not exists` to `ensureOpsSchema` so
PGLite/dev without a fresh migrate still works (same pattern as
`ops.server.ts`).

**Verify**: `bun test src/lib/league/allowlist.test.mjs` — empty list
allows; `"  Ryan@X.com "` matches `"ryan@x.com"`; missing email denied
when list nonempty.

### Step 2: Enforce on join / claim

`async function loadUserEmail(userId: string): Promise<string | null>`
reads Better Auth `user.email`.

`joinLeague`: after the league is found, if allowlist nonempty, require
`emailAllowed`.

`claimRoster`: same allowlist check. Add optional `code` to the fn
validator; if the caller is not already commish, require a matching
invite code (closes the "I know lg_ and rosterId" hole). Update the
settings claim button to pass `inviteCode` when the commish is seating
themselves; commish bypasses the code.

**Verify**: `rg -n "emailAllowed" src/lib/league/engine.server.ts`.

### Step 3: Member reads

`assertLeagueViewer(leagueId, userId)`:

- no `userId` → throw the same `UnauthorizedError` the auth middleware
  uses (import from `verify.server.ts`)
- else commish **or** `ff_rosters.owner_id = userId`

Call it at the start of hosted `loadLeagueBundle`, `loadDesk`,
`loadDraft`, `loadSettings`, `loadBook`, `listTrades`, `loadSchedule`,
`listClaims`, `readEvents` wrappers, `loadLeagueFacts` wrapper.

Do **not** call it from `previewInvite` or `joinLeague`.

Unsigned visit to `/league/lg_…` should fail the loader the way other
auth failures do (existing error component). Do not invent a new
marketing page.

**Verify**: `rg -n "assertLeagueViewer" src/lib/league src/lib/data/fns.ts`
covers the hosted GETs listed above. `previewInvite` is not in that
list.

### Step 4: Settings UI + catalog

Commish-only list: input + add, list of emails, remove. Empty state:
"Anyone with the code can join. Add emails to lock it."

Catalog: `listAllowlist` (commish, read), `addAllowlistEmail` /
`removeAllowlistEmail` (commish, atomic). Keep `joinLeague` description
honest ("code, plus allowlist if the commish seeded one").

**Verify**: `bun test src/lib/agent` still passes (ids match markdown).
`bun run typecheck`.

## Test plan

- `allowlist.test.mjs` as in step 1.
- Catalog id test already exists — it will fail if you add fns and
  forget the catalog. That is desired.

## Done criteria

- [ ] Empty allowlist = join-by-code only, same as today
- [ ] Nonempty allowlist = join/claim email must match (normalized)
- [ ] `claimRoster` is not an invite-free back door
- [ ] Hosted league GETs require commish or a seat
- [ ] `previewInvite` / `/join` remain public
- [ ] Catalog updated
- [ ] `bun run typecheck` and `bun test` pass

## STOP conditions

- Better Auth user table is not `user`/`email` and you cannot find the
  column in `migrations/0001_auth.sql` — stop and report the real names
- Gating a GET breaks the Grok preview anonymous walk of a demo league
  you cannot restore without inventing a public flag — stop; do not add
  a "public desk" toggle in this plan
- You are about to send email

## Maintenance notes

- 026's invite card stays the share path. Allowlist is extra, not a
  replacement for the code.
- Reviewer: reject a league-wide API key. Per-user session only.
- Sleeper `getMatchups` for numeric ids is out of scope on purpose.
