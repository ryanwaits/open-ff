# Plan 024: Publish the primitive catalog and a thin tool surface

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e6d44de..HEAD -- src/lib/league/fns.ts src/lib/data/fns.ts src/lib/league/events.server.ts src/lib/auth/middleware.ts AGENTS.md`
> On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 022 (tests exist), 023 (tick/invite/bids not public)
- **Category**: direction
- **Planned at**: commit `e6d44de`, 2026-08-18
  (reconciled from `553f159`: 014 landed — desk calls `loadLeagueFacts`;
  `dropPlayer` is a new atomic fn; still no `getEvents` / `getLeagueFacts`
  RPC and no `src/lib/agent/`)

## Why this matters

Every.to's test for agent-native: *describe an outcome in the domain that you
did not build a button for — can the agent loop until it succeeds?*

Ledger already has the **mechanics** (lineup, FAAB, trades, book, draft,
events). They are `createServerFn` RPCs callable only from the React tree.
There is no catalog, no MCP, no CLI, no readable ledger tool.

This plan does **not** invent a second engine. It names the primitives that
already exist, wraps the atomic ones as tools, and adds the two reads the
desk was saving for later (`readEvents`, `loadLeagueFacts`). Features stay
prompts over those tools. New markets (player props, etc.) stay a later
module contract — see Maintenance.

Two layers, do not collapse them:

1. **Runtime** — a manager/commish agent *uses* the league (this plan).
2. **Harness** — a coding agent *extends* the league by editing `src/`
   against a module contract (026 + future). "Add betting by describing it"
   is layer 2, and betting already shipped as a vertical slice. Layer 1 is
   "stake $5 on the spread" from Claude/Grok/a CLI.

## Current state

- ~50 `createServerFn`s in `src/lib/league/fns.ts` and `src/lib/data/fns.ts`
- Auth: `authMiddleware` / `optionalAuthMiddleware` in `src/lib/auth/middleware.ts`
- Atomic enough already: `makePick`, `startPlayer`, `sitPlayer`, `queueAdd`,
  `placeWager`, `pullWager`, `voteTrade`, `cancelClaim`, `setAutodraft`,
  `dropPlayer` (`fns.ts:207-214` — added after this plan was first written;
  catalog **must** include it)
- Workflow-shaped (keep as recipes, do not split in this plan):
  `createLeague`, `addDrop`, `saveSettings`, `advanceWeek`, `autoFillDraft`
- `readEvents` (`events.server.ts:146`) — **no** server fn, no UI
- `loadLeagueFacts(leagueId, throughWeek)` is used by the desk
  (`engine.server.ts:2336-2337`). **Still no** `getEvents` / `getLeagueFacts`
  server fn. Do not re-implement 014; wrap the existing export. The GET
  validator needs `leagueId` **and** `week` (pass `week` through as
  `throughWeek`).
- `pullWager` exists (`fns.ts:535`) — **no** UI import (do not add UI here)
- `bun test` is `bun test src scripts` (022). Do not shrink the glob.
- No MCP SDK in `package.json`. Do not `npm install` unless this plan's
  spike proves the official SDK is required — prefer a **stdio JSON catalog
  + curl-shaped CLI** first so any harness can call it.
- `AGENTS.md` is still the Grok sandbox template. A **domain** catalog
  belongs in `src/lib/agent/CATALOG.md` (or `.md` next to the tools), not
  as a rewrite of the sandbox file in this plan.

## Commands you will need

| Purpose    | Command                         | Expected |
|------------|---------------------------------|----------|
| Tests      | `bun test`                      | pass     |
| Typecheck  | `bun run typecheck`             | exit 0   |
| Lint       | `bun run lint`                  | exit 0   |
| Latest npm | `npm view @modelcontextprotocol/sdk version` | print a version (read only — do not install unless Step 3 says so) |

## Scope

**In scope**:
- `src/lib/agent/catalog.ts` — typed list of primitives (id, description,
  input zod already on the fn, scope `spectator | manager | commish`,
  atomic vs workflow)
- `src/lib/agent/CATALOG.md` — human/agent readable map (same data, generated
  or hand-kept; if hand-kept, a test asserts ids match `catalog.ts`)
- `src/lib/league/fns.ts` — add `getEvents` and `getLeagueFacts` GET fns
  (optionalAuth, same as `getActivity`)
- `src/lib/agent/cli.ts` or `scripts/ledger.mjs` — `bun scripts/ledger.mjs --help`
  lists tools; `bun scripts/ledger.mjs <tool> --json '{...}'` calls the
  **same** engine functions the server fns call (import `engine.server` /
  `ops.server` / `wagers.server` / `events.server` / `league-facts.server`).
  For a first slice, support **read** tools only plus `--list`.
- `src/lib/agent/cli.test.mjs` — `--help` prints `getEvents` and `placeWager`
- JSDoc on the exported catalog, not on every line of `engine.server.ts`

**Out of scope**:
- In-app chat UI
- Rewriting `saveSettings` / `addDrop` into PATCH atoms
- Market registry / new wager kinds
- Event-sourcing the league (events stay a diary)
- Auth tokens / PAT minting (CLI may require `LEDGER_USER_ID` only in
  **dev** and refuse to run if `NODE_ENV=production` without a real session
  story — do not ship a production backdoor)
- Editing `AGENTS.md` sandbox contract
- UI for `pullWager` or facts (014)
- Installing an MCP SDK "just in case"

## Suggested executor toolkit

- Every.to agent-native guide: tools = atoms, features = prompts.
- Do not add a tool that the UI cannot eventually share. Parity.

## Git workflow

- Commit: `feat: catalog league primitives for agents and a read CLI`
- Do NOT push

## Steps

### Step 1: Write the catalog as data

Create `src/lib/agent/catalog.ts`.

Each entry:

```ts
export type AgentScope = "spectator" | "manager" | "commish";
export type AgentTool = {
  id: string;           // matches the server fn export name
  title: string;
  description: string;  // one sentence, outcome-oriented
  scope: AgentScope;
  kind: "atomic" | "workflow" | "read";
  mutating: boolean;
};
```

Include **every** export from `fns.ts` + `data/fns.ts` plus the two new
reads. Mark:

- `tick` / `tickAllLeagues` — **omit**. Not a tool.
- `previewEspn` / `importEspn` — include but description must say
  "never log swid/espnS2; not for traces."
- `saveSettings` — workflow
- `placeWager` / `pullWager` — atomic
- `getBook` — read
- `getEvents` / `getLeagueFacts` — read

Create `src/lib/agent/CATALOG.md` with a table: id | scope | kind | one-liner.
A test reads both and asserts the same ids.

**Verify**: `bun test src/lib/agent` → catalog ids === markdown ids ===
export names you listed.

### Step 2: Expose the ledger reads

In `src/lib/league/fns.ts`, next to `getActivity`:

```ts
export const getEvents = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({
    leagueId: z.string(),
    limit: z.number().optional(),
    sinceWeek: z.number().optional(),
  }))
  .handler(async ({ data }) => {
    const ev = await import("./events.server");
    return ev.readEvents(data.leagueId, {
      limit: data.limit,
      sinceWeek: data.sinceWeek,
    });
  });

export const getLeagueFacts = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ leagueId: z.string(), week: z.number() }))
  .handler(async ({ data }) => {
    const facts = await import("./league-facts.server");
    return facts.loadLeagueFacts(data.leagueId, data.week);
  });
```

Confirm `loadLeagueFacts` is exported as
`(leagueId: string, throughWeek: number)`. Wrap it — do not change fact math.

**Verify**: `bun run typecheck` exits 0. `rg -n "export const getEvents" src/lib/league/fns.ts`.

### Step 3: Read-only CLI

`scripts/ledger.mjs`:

```
bun scripts/ledger.mjs --help
bun scripts/ledger.mjs getEvents --league <id> --limit 20
bun scripts/ledger.mjs getLeagueFacts --league <id> --week <n>
```

Implementation: import catalog, dispatch by id, call the **server module**
(not HTTP). If `getSql` requires a running app, document:

```
# from repo root, with the same DATABASE_URL the app uses
bun scripts/ledger.mjs getEvents --league lg_…
```

and have `--help` work with **zero** DB.

Do **not** implement mutating CLI in this plan (no `placeWager` from argv).
The catalog still *lists* them so a later plan / MCP can wire them.

**Verify**: `bun scripts/ledger.mjs --help` prints `getEvents` and
`placeWager` and does not connect to a DB. Exit 0.

### Step 4: One context blurb

Add `src/lib/agent/context-prompt.md` (static) that a harness can prepend:

- What open-ff is
- Scopes
- Invariants: one FAAB purse for claims + wagers; cannot fade yourself;
  on-clock pick is not tradeable; betting off until `bettingOn`; mock draft
  is ephemeral; do not call tick
- "If you need a capability that is not in the catalog, stop. Do not invent
  a table."

**Verify**: file exists and is referenced from `CATALOG.md`.

## Test plan

- `src/lib/agent/catalog.test.mjs` — ids match across ts / md / fns exports
  you enumerated (at least the 15 atomic + 2 new reads)
- CLI `--help` smoke
- Pattern: `scripts/query-persist.test.mjs`

## Done criteria

- [ ] Catalog lists every current server fn plus `getEvents` / `getLeagueFacts`
- [ ] `tickAllLeagues` is not a tool
- [ ] `getEvents` / `getLeagueFacts` are real GET server fns
- [ ] `bun scripts/ledger.mjs --help` works offline
- [ ] `bun test` / `typecheck` / `lint` pass
- [ ] No MCP dependency added
- [ ] `plans/README.md` updated

## STOP conditions

- `loadLeagueFacts` is not exported or you cannot wrap
  `(leagueId, throughWeek)` in 10 lines — stop
- You believe you need `@modelcontextprotocol/sdk` to finish — stop and
  report; this plan's slice is catalog + CLI
- Temptation to split `saveSettings` — out of scope
- Temptation to add an in-app agent panel

## Maintenance notes

**How a new feature should appear (the betting lesson):**

1. Mechanic in a module (`wagers.server.ts`) with atomic verbs.
2. Zod server fns in `fns.ts`.
3. One catalog row per verb (`placeWager`, `pullWager`, `getBook`).
4. Settings knobs are data (`bettingOn`), not a new app.
5. Events for the story (`wager_placed`).
6. UI last, sharing the same fn.

A commish saying "let people bet the over" should **not** start in
`engine.server.ts`. Next plan after this (not now): a `WagerMarket`
registry (`spread` / `moneyline` / later `total`) so a coding agent adds a
file, not a closed enum. **Do not do that until 022's conservation tests
exist** and someone decides whether to fix the mint.

**Parity discipline:** when you add a UI button, add or reuse a catalog
row in the same PR.

**Auth for real remote agents:** follow-up. Per-user token, scopes above,
never a league-wide key. Never take `userId` from the model.

Reviewer: reject a second engine, an MCP install, or a chat widget.
