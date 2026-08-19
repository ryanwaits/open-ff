# Plan 042: Speak MCP on stdio so Codex can call the catalog locally

> **Executor instructions**: Follow this plan step by step. Run every
> verification. If a STOP fires, report — do not improvise. Update
> `plans/README.md` unless a reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 735b0ba..HEAD -- src/lib/agent scripts/ledger.mjs src/lib/league/fns.ts package.json`
> On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/038-agent-context-dump.md, plans/033-place-wager-cli.md
  (dump + at least one mutating dispatch exist so MCP is not a hollow socket)
- **Category**: direction
- **Planned at**: commit `735b0ba`, 2026-08-19

## Why this matters

The install path for a commish on their box is:

```
codex mcp add openff --command bun --args scripts/mcp.mjs
```

(or `claude mcp add` / `grok mcp add` with the same command). That
process is **stdio JSON-RPC**. It must call the **same** engine
functions the PWA uses, with `OPENFF_USER` + `DATABASE_URL`. It is
not a second engine. It is not HTTP (043). It is not a plugin box.

024 forbade installing `@modelcontextprotocol/sdk` “just in case.”
This plan **is** the case. Look up the current version first.

## Current state

- `AGENT_TOOLS` in `src/lib/agent/catalog.ts` — 67 ids, 1:1 with
  `createServerFn` exports (`catalog.test.mjs`).
- `scripts/ledger.mjs` dispatches `getEvents` / `getLeagueFacts`
  (and after 038, `getAgentContext`; after 033, `placeWager --write`).
  Direct engine imports, no session.
- bun cannot migrate PGLite (`import.meta.glob`). Live MCP needs
  `DATABASE_URL` like the CLI. Document that.
- `createServerFn` handlers need TanStack request ALS. The MCP
  process **must not** call those. Call `engine.server` /
  `wagers.server` / `ops.server` / `agent-context.server` with an
  explicit `userId`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Latest SDK | `npm view @modelcontextprotocol/sdk version` | a version string |
| Tests | `bun test src/lib/agent` | pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Help | `bun scripts/mcp.mjs` is long-running — do not hang the plan. Drive it from a test with a fake transport or a `list_tools` unit on the dispatcher. |

## Scope

**In scope**:
- `src/lib/agent/core.ts` — `AGENT_CORE` allowlist (ids below)
- `src/lib/agent/dispatch.ts` — `dispatch(id, userId, args) → json`
- `scripts/mcp.mjs` — stdio MCP, tools = `AGENT_CORE`
- `src/lib/agent/dispatch.test.mjs` — unknown id throws; `tick` /
  `tickAllLeagues` refused; mutating without userId refused
- `package.json` — add the SDK **after** `npm view` (bun add)
- README: 8-line “Codex / Claude / Grok local” install
- Optional: `ledger.mjs` calls `dispatch` for the ids it already
  handles (no behavior change)

**Out of scope**:
- HTTP `/mcp` (043)
- Tokens (041)
- Skills markdown (044)
- Registering all 67 tools
- A second scoring engine
- Chat UI

## Core tool ids (this slice only)

Reads: `getAgentContext`, `listMyLeagues`, `getTeam`, `getBook`,
`getMatchups`, `getWire`, `getDraft`, `getSettings`, `getEvents`,
`getLeagueFacts`.

Atoms: `sitPlayer`, `startPlayer`, `dropPlayer`, `placeWager`,
`pullWager`, `makePick`, `queueAdd`, `voteTrade`.

Migrate: `previewImport`, `importLeague` (require `confirm === true`
on import; if the fn has no such field yet, accept `confirm` in
dispatch and refuse when missing — do not change ESPN cookie
logging).

**Verify list in code**: `AGENT_CORE` is a `Set` of those strings.
A test asserts every id exists in `AGENT_TOOLS` and none is `tick`.

## Git workflow

- Branch: current
- Commit: `feat: speak the catalog over MCP stdio`
- Do NOT push

## Steps

### Step 1: Allowlist + dispatch

`dispatch.ts`: switch or map on `id`. Each branch calls the
existing server export with `userId`. Unknown id → throw
`Unknown tool`. `tick` / `tickAllLeagues` → throw even if someone
passes them. Import `placeWager` from `wagers.server.ts` the same
way 033 did.

`userId` comes from `process.env.OPENFF_USER` in the stdio process
(not from the model). Args come from the tool call.

**Verify**: `bun test src/lib/agent/dispatch.test.mjs` — unknown id,
tick refused, core ids ⊆ catalog.

### Step 2: SDK + stdio server

`npm view @modelcontextprotocol/sdk version` then
`bun add @modelcontextprotocol/sdk@<that>`.

`scripts/mcp.mjs`: stdio transport, `ListTools` = AGENT_CORE with
names/descriptions from `AGENT_TOOLS`, `CallTool` → `dispatch`.
On boot, if `OPENFF_USER` or `DATABASE_URL` missing, print to
**stderr** and exit 1 (hosts inherit stderr).

Do not import Vite, React, or `fns.ts`.

**Verify**: `rg -n "from \\"@/lib/league/fns\\"" scripts/mcp.mjs`
empty. `rg -n "AGENT_CORE" scripts/mcp.mjs src/lib/agent`.

### Step 3: README

Under a heading **Agent hosts (local)**:

```
export DATABASE_URL=postgres://…
export OPENFF_USER=<your user id>
codex mcp add openff --command bun --args scripts/mcp.mjs
# Claude: claude mcp add openff -- bun scripts/mcp.mjs
# Grok:   grok mcp add openff -- bun scripts/mcp.mjs
```

User id: the Better Auth `user.id` (settings can show it after 041;
until then, document “copy from the `user` table / local seed”).

**Verify**: `rg -n "mcp add openff" README.md`.

## Test plan

- dispatch unit tests (no live DB).
- Do not try to speak MCP to a running Codex in this plan.

## Done criteria

- [ ] `AGENT_CORE` ⊆ `AGENT_TOOLS`, no tick
- [ ] stdio server lists those tools
- [ ] CallTool hits the real engine fns with `OPENFF_USER`
- [ ] SDK version was looked up, not guessed
- [ ] `bun test src/lib/agent` and `bun run typecheck` pass

## STOP conditions

- SDK install wants a native compile you cannot do — stop, implement
  a 40-line JSON-RPC stdio loop instead, still named `scripts/mcp.mjs`
- You are about to expose all 67 tools
- You import `createServerFn` handlers into the MCP process
- `getAgentContext` is missing (038 not landed) — stop

## Maintenance notes

- 043 is the same `dispatch`, different transport + token.
- Adding a verb to MCP = add the id to `AGENT_CORE` and a dispatch
  branch. Catalog 1:1 still owns the name.
- Reviewer: reject a server that takes `userId` from the model.
