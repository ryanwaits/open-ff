# Plan 038: Give an agent one dump of who, purse, facts, and verbs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to
> the next step. If anything in the "STOP conditions" section occurs, stop
> and report — do not improvise. When done, update your row in
> `plans/README.md` unless a reviewer said they maintain the index.
>
> **Drift check (run first)**: `git diff --stat dd9bc53..HEAD -- src/lib/agent src/lib/league/fns.ts src/lib/league/book.server.ts src/lib/league/wagers.server.ts scripts/ledger.mjs`
> On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/024-agent-primitive-surface.md (DONE — catalog exists;
  CLI only dispatches `getEvents` / `getLeagueFacts`)
- **Category**: direction
- **Planned at**: commit `dd9bc53`, 2026-08-19

## Why this matters

Every's agent-native test: *describe an outcome in the domain you did not
build a button for — can the agent loop until it succeeds?* 024 named 67
verbs. The CLI still only dumps the diary and standing facts. An agent
cannot see spendable FAAB, the book, its seat, or which tools it may call
without opening React. That is **context starvation** — the guide's named
anti-pattern.

This plan does not invent a chat widget or MCP. It adds one **read**
(`getAgentContext`) that is the Postgres-shaped cousin of `context.md`,
wires it through `fns.ts` + the catalog test, and lets `ledger.mjs`
dispatch it. Features stay prompts over existing verbs.

## Current state

- Catalog is 1:1 with `createServerFn` exports (`src/lib/agent/catalog.test.mjs:22-29`).
  Adding a fn **requires** a catalog row + CATALOG.md row.
- `scripts/ledger.mjs:81-100` only dispatches `getEvents` / `getLeagueFacts`.
  Other reads fail with "this CLI slice only dispatches…".
- `getBook` (`fns.ts:591-599`) returns `purse.free` (= `spendable`) **only
  when `betting_on`**. Empty book when betting is off (`book.server.ts:137-148`).
- `loadLeagueBundle` already has `faabRemaining` / `faabAtRisk`
  (`engine.server.ts:616-617`) but the CLI cannot call it.
- `context-prompt.md` is a static stub. Do not replace it; the dump is live.
- CLI has no cookie. Operator with `DATABASE_URL` is god on that DB. Pass
  `--user <id>` of a seat holder so the dump is *their* purse. Do not invent
  an API key.
- bun cannot migrate PGLite. Live reads still need `DATABASE_URL`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Tests | `bun test src/lib/agent` | pass, including new dump cases |
| Help | `bun scripts/ledger.mjs --help` | lists `getAgentContext` |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bunx biome check` on files you edit | exit 0 |

## Scope

**In scope**:
- `src/lib/league/agent-context.server.ts` (create) — `loadAgentContext`
- `src/lib/league/fns.ts` — `getAgentContext` GET + `optionalAuthMiddleware`
  + `assertLeagueViewer`
- `src/lib/agent/catalog.ts` + `CATALOG.md` — spectator **read**
- `src/lib/agent/context-prompt.md` — one paragraph pointing at the dump
- `scripts/ledger.mjs` — dispatch `getAgentContext`
- `src/lib/agent/cli.test.mjs` — help lists it; missing `--league` / `--user`
  fails without a DB
- `src/lib/agent/catalog.test.mjs` — already 1:1; will pass if catalog updated

**Out of scope**:
- MCP SDK
- Mutating CLI (`placeWager` is 033)
- Dispatching every remaining read
- Changing `spendable` / `applyLoss`
- In-app chat / a Grok loop inside the desk
- Gating hosted GETs (030)

## Git workflow

- Branch: current
- Commit: `feat: dump league context for an agent in one read`
- Do NOT push

## Steps

### Step 1: Pure-ish loader

Create `src/lib/league/agent-context.server.ts`. `loadAgentContext(leagueId, userId | null)`:

1. Load the league row (reuse `getLeague` from engine, or a tight select).
2. Resolve seat: `rosterId` / `teamName` / `isCommish` from `ff_rosters` +
   `commish_id`. Unsigned → those fields null.
3. Purse: `spendable(leagueId, rosterId, remaining)` and `atRisk` from
   `wagers.server.ts` when there is a seat; else zeros. **Do this even
   when betting is off** — that is the point vs `getBook`.
4. Facts: `loadLeagueFacts(leagueId, current_week)`.
5. Events: `readEvents(leagueId, { limit: 20 })`.
6. Tools: filter `AGENT_TOOLS` by scope (`commish` if isCommish, else
   `manager` if seat, else `spectator`). Return `{ id, scope, kind }[]`
   — not the full descriptions.

Return JSON:

```ts
{
  leagueId: string;
  name: string;
  week: number;
  status: string;
  you: { userId: string; rosterId: number; teamName: string; isCommish: boolean } | null;
  purse: { remaining: number; atRisk: number; spendable: number } | null;
  knobs: { bettingOn: boolean; wagerCap: number; exposureCap: number; bookLocked: boolean };
  facts: Array<{ kind: string; teams: string[]; text: string }>;
  recent: Array<{ id: string; week: number; kind: string; amount: number | null; at: string }>;
  tools: Array<{ id: string; scope: string; kind: string }>;
}
```

Do not embed full event payloads (token cost). Do not call `loadDesk`
(prose, not state).

**Verify**: `rg -n "export async function loadAgentContext" src/lib/league/agent-context.server.ts`.
`rg -n "loadDesk" src/lib/league/agent-context.server.ts` is empty.

### Step 2: Server fn + catalog

`getAgentContext` in `fns.ts` next to `getLeagueFacts`:

```ts
export const getAgentContext = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.assertLeagueViewer(data.leagueId, context.userId);
    const ctx = await import("./agent-context.server");
    return ctx.loadAgentContext(data.leagueId, context.userId);
  });
```

Catalog: spectator, read, one-liner "Seat, spendable FAAB, facts, recent
events, and the tools in your scope." CATALOG.md table row. Context
prompt: add "Start a session with `getAgentContext`."

**Verify**: `bun test src/lib/agent/catalog.test.mjs` — ids match.

### Step 3: CLI dispatch

`scripts/ledger.mjs` `dispatchRead`:

- `getAgentContext` requires `--league` and `--user`.
- Import `loadAgentContext` directly (same pattern as `readEvents` —
  CLI still bypasses the HTTP door; 030 does not apply here).
- Print JSON.

Help text: mention `--user` for the dump.

Tests in `cli.test.mjs`:
- `--help` matches `/getAgentContext/`
- `getAgentContext --league lg_x` without `--user` exits non-zero, no DB
  required

**Verify**: `bun test src/lib/agent` pass.

## Test plan

- Catalog 1:1 (existing).
- CLI help + missing `--user` (new).
- Do **not** stand up PGLite under bun.

## Done criteria

- [ ] `getAgentContext` exists as a viewer-gated GET
- [ ] Catalog + CATALOG.md include it
- [ ] CLI dispatches it with `--league` + `--user`
- [ ] Purse is present even when betting is off
- [ ] `bun test src/lib/agent` and `bun run typecheck` pass
- [ ] No MCP, no mutations

## STOP conditions

- You would dump the whole `getDesk` article list "as context"
- You would skip `--user` and pick a random roster
- `assertLeagueViewer` is missing or renamed
- You start dispatching `placeWager` (that is 033)

## Maintenance notes

- New catalogued reads that an agent needs every turn should fold into
  this dump rather than growing `ledger.mjs` one-off.
- Reviewer: reject a dump that omits spendable when `betting_on` is 0.
- 033 (mutating CLI) should run **after** this, not before.
