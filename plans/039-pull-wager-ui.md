# Plan 039: Let a manager pull an open ticket from the book list

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to
> the next step. If a STOP fires, report — do not improvise. When done,
> update your row in `plans/README.md` unless a reviewer said they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7545fdb..HEAD -- src/components/wager-ticket.tsx src/components/book-panel.tsx src/routes/league/$leagueId/standings.tsx src/lib/league/fns.ts src/lib/league/wagers.server.ts`
> On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/024-agent-primitive-surface.md (DONE — `pullWager`
  RPC exists, no UI)
- **Category**: direction
- **Planned at**: commit `7545fdb`, 2026-08-19 (reconciled; still no `wager-pull`)

## Why this matters

Every's **parity** test is bidirectional: anything the UI can do, the
agent can do — and anything the agent can do should be visible in the
product. `pullWager` is catalogued (`catalog.ts:278`) and wired
(`fns.ts:631-636`, `wagers.server.ts:295-319`). The ticket UI only
imports `placeWager` (`wager-ticket.tsx:7`). Standings lists open
positions with no withdraw control (`standings.tsx:338-356`). A human
who fat-fingered a $20 ticket has to wait for lock. That is an **orphan
RPC** — the reverse of an orphan UI action.

Do not add a new mechanic. Call the existing `pullWager`.

## Current state

`pullWager` already enforces: seat, owner, `status === "placed"`, book
not locked for that week. It writes `wager_pulled`.

`BookPosition` (`book.server.ts:31-46`): `id`, `mine`, `status`, `stake`,
`sideName`, `kind`, `line`, `week`. Open positions are in
`book.positions`; they stay private until lock (`book.server.ts:253`).

Standings book list (`standings.tsx:338-356`): six open tickets, stake
on the right, no button.

`wager-ticket.tsx` is the *place* dialog. Do not cram pull into it.

029 testids (`wager-price`, `wager-stake`, `wager-submit`,
`wager-no-price`) stay. Add `wager-pull` on the new control.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test scripts/wager-testid.test.mjs src/lib/agent` | pass |
| Lint | `bunx biome check` on files you edit | exit 0 |

## Scope

**In scope**:
- `src/routes/league/$leagueId/standings.tsx` — pull control on `p.mine
  && p.status === "placed"` while `!book.data.locked`
- `src/lib/league/fns.ts` — **do not change** `pullWager` unless the
  import path is wrong
- Optional tiny helper in `book-panel.tsx` if the row gets noisy —
  prefer inline on the existing `<li>` first
- `scripts/wager-testid.test.mjs` — assert `wager-pull` exists in
  standings source (same style as the existing testids test)

**Out of scope**:
- Commish void / `voided` status (exists on the type, unused)
- CLI dispatch of `pullWager` (033 is place only)
- New wager kinds
- Restyling the book section
- Escrow

## Git workflow

- Branch: current
- Commit: `feat: let a manager pull an open FAAB ticket`
- Do NOT push

## Steps

### Step 1: Wire the existing RPC

In the standings book `<li>` for each `p`:

- If `p.mine && p.status === "placed" && !book.data.locked`: a text
  button "Pull" with `data-testid="wager-pull"` (or
  `data-testid={`wager-pull-${p.id}`}` if more than one).
- `useMutation` calling `pullWager({ data: { leagueId, wagerId: p.id } })`.
- On success: invalidate `["book", leagueId]` (same keys as
  `wager-ticket.tsx:77-79`). Toast `Pulled $${p.stake}.`
- On error: toast the thrown message. Do not swallow.

Non-mine rows unchanged. Locked week: no button (engine would throw).

**Verify**: `rg -n "pullWager" src/routes/league/\$leagueId/standings.tsx`.
`rg -n "wager-pull" src/routes/league/\$leagueId/standings.tsx`.

### Step 2: Testid lock

`scripts/wager-testid.test.mjs` already greps ticket testids. Add:
source of `standings.tsx` matches `/wager-pull/` and `/pullWager/`.

**Verify**: `bun test scripts/wager-testid.test.mjs`.

## Test plan

- Source-string test only. Do not require a live ticket (preseason may
  still be no-price; 032 covers the place path).
- Engine pull cases already live in `wagers.server.ts`; do not re-test
  fade-self here.

## Done criteria

- [ ] Mine + placed + unlocked shows Pull
- [ ] Click calls `pullWager` with that `wagerId`
- [ ] Locked / not-mine / settled: no button
- [ ] `bun run typecheck` pass
- [ ] No new market code

## STOP conditions

- `pullWager` signature no longer `(userId, leagueId, wagerId)` — wrap
  in 10 lines or stop
- You would add a commish "void" while here
- You restyle LinePanel / the ticket dialog

## Maintenance notes

- After lock, open positions become public (`book.server.ts:253`). Pull
  is already illegal then — keep the button off rather than showing a
  dead control.
- Reviewer: reject a pull that does not check `p.mine` on the client
  (server still enforces; the client must not offer it).
