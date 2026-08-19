# Plan 043: Serve the same MCP over HTTP with the personal token

> **Executor instructions**: Follow this plan step by step. If a STOP
> fires, report. Update `plans/README.md` unless told not to.
>
> **Drift check (run first)**: `git diff --stat 735b0ba..HEAD -- src/lib/agent src/lib/auth src/routes/api package.json`
> On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: plans/041-agent-tokens.md, plans/042-mcp-stdio.md
- **Category**: direction
- **Planned at**: commit `735b0ba`, 2026-08-19

## Why this matters

Local stdio (042) is the commish-on-the-box path. A friend with only
the PWA + a Codex install needs:

```
codex mcp add openff --url https://YOUR_HOST/api/mcp \
  --bearer-token-env-var OPENFF_TOKEN
```

Same `dispatch` / `AGENT_CORE`. Auth is `Authorization: Bearer off_…`
from 041. Isolation already allows non-browser requests with no
`Sec-Fetch-Site`. Do not send session cookies to Codex.

## Current state

- API routes live under `src/routes/api/` (`auth/$`, `league/tick`).
  Add `src/routes/api/mcp.ts` (or `mcp.$.ts` if the SDK wants a
  splat). Tick’s secret pattern (`tick.ts` Bearer / `?secret=`) is
  the closest existing chokepoint — copy **structure**, not the
  cron secret.
- After 041, `requireUserId` accepts `off_`.
- After 042, `dispatch(id, userId, args)` exists.
- `authMiddleware` still calls `assertSameSiteRequest` then
  `requireUserId`. A raw API route will **not** go through
  `authMiddleware`; it must call `lookupToken` / `requireUserId`
  itself. Do not disable isolation globally.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test src/lib/agent src/lib/auth` | pass |
| Route | `rg -n "api/mcp" src/routes` | hits the new file |

## Scope

**In scope**:
- `src/routes/api/mcp.ts` — Streamable HTTP MCP (or POST JSON-RPC
  if the SDK’s HTTP helper is ugly — pick one, document it)
- Wire `dispatch` + `AGENT_CORE`
- Bearer `off_` required on every call. Missing/unknown → 401
- README: hosted install snippet next to the local one
- `scripts/mcp-http.test.mjs` — source-string: route calls
  `lookupToken` or `requireUserId`, does **not** mention
  `OPENFF_USER`, does **not** import `tickAllLeagues`

**Out of scope**:
- OAuth-for-MCP / dynamic client registration
- Exposing all 67 tools
- CORS `*` with cookies
- Skills (044)
- Changing tick auth

## Git workflow

- Branch: current
- Commit: `feat: serve catalog MCP over HTTP with personal tokens`
- Do NOT push

## Steps

### Step 1: Route

POST (and whatever GET the SDK needs for SSE/streamable HTTP) at
`/api/mcp`. First line of the handler: resolve user from
`Authorization`. Then `ListTools` / `CallTool` via 042’s helpers.

Never read `OPENFF_USER` here. Never trust a `userId` field in the
JSON-RPC params.

**Verify**: `rg -n "OPENFF_USER" src/routes/api/mcp.ts` empty.
`rg -n "lookupToken|requireUserId" src/routes/api/mcp.ts`.

### Step 2: README

```
export OPENFF_TOKEN=off_…          # minted in the app, 041
codex mcp add openff --url https://HOST/api/mcp --bearer-token-env-var OPENFF_TOKEN
```

Same URL for Claude (`-t http`) and Grok (`--transport http`).

**Verify**: `rg -n "/api/mcp" README.md`.

### Step 3: Tests

Source-string as above. A unit that `dispatch` is used (import
path). Do not live-hit production.

**Verify**: `bun test scripts/mcp-http.test.mjs`.

## Done criteria

- [ ] `/api/mcp` lists `AGENT_CORE`
- [ ] Calls run as the token’s user
- [ ] No cookie required
- [ ] Unknown token 401
- [ ] `bun run typecheck` pass

## STOP conditions

- You would accept `userId` in the tool arguments
- Streamable HTTP vs SSE is unclear and you are about to ship both
  — pick POST JSON-RPC, document `codex mcp add --url`, stop if
  Codex rejects it and report
- 041 lookup is missing

## Maintenance notes

- Vercel: this is a serverless route. MCP Streamable HTTP may need
  a long-lived connection — if the SDK requires SSE that Vercel
  kills, STOP and use request/response JSON-RPC. Do not invent a
  second origin.
- Reviewer: reject CORS that reflects any origin with
  `credentials: true`.
