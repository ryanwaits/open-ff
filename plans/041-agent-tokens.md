# Plan 041: Mint a personal token so a host can act as a seat

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> If a STOP fires, report — do not improvise. Update `plans/README.md`
> unless a reviewer said they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7545fdb..HEAD -- src/lib/auth/verify.server.ts src/lib/auth/middleware.ts src/lib/auth/isolation.server.ts src/lib/auth/server.ts src/routes/league/$leagueId/settings.tsx migrations`
> On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: plans/038-agent-context-dump.md (dump exists so a
  token is useful)
- **Category**: security
- **Planned at**: commit `7545fdb`, 2026-08-19 (reconciled from `735b0ba`;
  next migration is **0013**, not 0012)

## Why this matters

Codex / Claude / Grok can call tools. They cannot guess you are roster
3. The PWA uses a same-origin cookie (`verify.server.ts` →
`auth.api.getSession`). A CLI on another machine has no cookie.
`--user` on `ledger.mjs` is operator-god-mode (you have `DATABASE_URL`).
A **hosted friend** needs a personal access token that maps to the
same `userId` the cookie would have, so `assertLeagueViewer` still
holds. Without this, “install open-ff in Codex” only works for the
person who owns the database.

Do **not** rewrite `src/lib/auth/server.ts`. Do **not** add Better
Auth’s apiKey plugin. Own table, own hash, prefix `off_`.

League Loom seals ESPN cookies into a user-held AES token with
**no server revoke** (“reconnect does not revoke an older
token”). Steal the *user holds the bearer* idea. Do **not** steal
unrevokable. Hash at rest so `revokeAgentToken` is real. Our
token is **our user**, not a bag of espn_s2. After migrate (045),
we do not need ESPN cookies in the token at all.

## Current state

- `requireUserId` (`verify.server.ts:83-96`) only accepts a Better
  Auth session (cookie or preview bearer forwarded into
  `Authorization`).
- `assertSameSiteRequest` (`isolation.server.ts:34-51`) allows
  requests with **no** `Sec-Fetch-Site` (non-browser). Codex HTTP
  MCP typically sends none, so isolation is already fine for a
  token header. Do **not** weaken the cookie path.
- Settings (`src/routes/league/$leagueId/settings.tsx`) is
  commish-dense **and now has DeleteLeague** (`fa38680`). Token mint
  belongs on **account**, not per-league — a token is the user,
  seats come from `ff_rosters`. Put the mint UI on `/` (signed-in
  home) or a small account strip, **not** only on one league’s
  settings. If home is too tight, a row on settings that says
  “this token is you, every league you sit” is ok. Do not restyle
  DeleteLeague.
- Migrations are ordered files. **`0012_waiver_holds.sql` already
  exists** (`7545fdb`). Next is `migrations/0013_agent_tokens.sql`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test src/lib/auth src/lib/agent` | pass |
| Lint | `bunx biome check` on files you edit | exit 0 |

## Scope

**In scope**:
- `migrations/0013_agent_tokens.sql`
- `src/lib/auth/tokens.server.ts` (create) — mint, hash, lookup, revoke
- `src/lib/auth/verify.server.ts` — `requireUserId` / `getSessionUser`
  accept `Bearer off_…` **after** session miss
- `src/lib/league/fns.ts` — `mintAgentToken` / `listAgentTokens` /
  `revokeAgentToken` (authMiddleware). **Do not** put these in
  `AGENT_TOOLS` — a token must not mint tokens. If the catalog 1:1
  test then fails, exclude ids matching `/AgentToken$/` in
  `catalog.test.mjs` with a comment.
- Signed-in UI to mint (show plaintext **once**), list prefixes,
  revoke
- `src/lib/auth/tokens.test.mjs` — hash lookup, unknown token,
  revoked token
- `.env.example` — no token values; a one-line comment that tokens
  are minted in-app

**Out of scope**:
- MCP server (042 / 043)
- Rewriting `server.ts` / Better Auth plugins
- League-scoped tokens (a token is a user)
- OAuth device flow
- Weakening `assertSameSiteRequest` for cookie POSTs

## Git workflow

- Branch: current
- Commit: `feat: mint personal tokens for agent hosts`
- Do NOT push

## Steps

### Step 1: Table + hash helpers

`migrations/0013_agent_tokens.sql`:

```sql
create table if not exists ff_agent_tokens (
  id text primary key,
  user_id text not null,
  name text not null default 'codex',
  prefix text not null,
  hash text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists ff_agent_tokens_hash on ff_agent_tokens (hash)
  where revoked_at is null;
```

`tokens.server.ts`:

- Plaintext format: `off_` + 32+ bytes hex (or base64url).
- Store `sha256(plaintext)` hex. Never store plaintext.
- `lookupToken(raw) → userId | null` — prefix check, hash, not revoked.
- `mintToken(userId, name) → { id, token }` (token only here).
- `revokeToken(userId, id)`.
- Also `create table if not exists` in the module (same dual-schema
  pattern as allowlist / wagers) so PGLite without a migrate still
  works.

**Verify**: `rg -n "off_" src/lib/auth/tokens.server.ts`.
`rg -n "create table if not exists ff_agent_tokens" src/lib/auth/tokens.server.ts`.

### Step 2: Accept bearer in verify

In `getSessionUser` / `requireUserId`: if `Authorization` (request
header **or** the preview `bearerToken` arg) starts with `off_`,
`lookupToken` and return that user. Do **not** pass `off_` tokens
into `auth.api.getSession`. Session cookie path unchanged.

**Verify**: `rg -n "lookupToken" src/lib/auth/verify.server.ts`.
`rg -n "assertSameSiteRequest" src/lib/auth/middleware.ts` still
present on `authMiddleware`.

### Step 3: Mint UI + fns

POSTs behind `authMiddleware`. UI: “Create token”, name field,
one-shot copy, then gone. List: `off_abcd…` prefix + revoke.
Never log the plaintext (`console.log` / events).

**Verify**: `rg -n "mintAgentToken" src/lib/league/fns.ts`.
`rg -n "console\\.(log|info).*off_" src` empty.

### Step 4: Tests

`tokens.test.mjs` (node:test, no DB if you extract hash+compare
pure; otherwise skip live SQL like 031 — prefer pure hash roundtrip
plus a source-string test that `requireUserId` mentions `off_`).

If catalog 1:1 breaks, exclude `mintAgentToken|listAgentTokens|revokeAgentToken`
from the fns-export set in `catalog.test.mjs` with a one-line reason.

**Verify**: `bun test src/lib/auth/tokens.test.mjs src/lib/agent/catalog.test.mjs`.

## Done criteria

- [ ] `off_` bearer resolves to `userId`
- [ ] Revoked / unknown token → Unauthorized
- [ ] Cookie session still works
- [ ] Plaintext shown once, hashed at rest
- [ ] Catalog test pass
- [ ] `bun run typecheck` pass

## STOP conditions

- You would rewrite `server.ts`
- You would skip hashing and store the raw token
- You would disable `assertSameSiteRequest` for all POSTs
- Catalog 1:1 fails and you cannot exclude the three fns cleanly

## Maintenance notes

- 043 HTTP MCP sends this bearer. 042 stdio does **not** need it
  (process env `OPENFF_USER` + `DATABASE_URL`).
- Reviewer: reject a token that is league-scoped or logged.
