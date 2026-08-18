# Plan 010: Draft queue — the list that drafts for you

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9948a37..HEAD -- src/lib/league/engine.server.ts src/lib/league/fns.ts src/routes/league/\$leagueId/draft.tsx src/components/draft-board.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/006 (needs `ff_queue`), plans/009 (autodraft is what
  makes the queue matter)
- **Category**: direction
- **Planned at**: commit `9948a37`, 2026-08-17

## Why this matters

Plan 009 makes a missed clock put a manager on autodraft indefinitely. That
turns autopick from a rare fallback into something that can draft an entire
roster. Right now autopick takes best-available-by-need
(`nextAutopick`, `engine.server.ts:348`), which is fine for one pick and poor
for ten in a row.

A queue fixes that with one list doing two jobs: it is the wish list you fill
while waiting, and it is the order autodraft takes. One list, so nobody has to
find and fill a separate "autodraft preferences" screen that in practice nobody
ever fills in.

## Current state

### ⚠ `engine.server.ts` is `@ts-nocheck`

The file begins (`src/lib/league/engine.server.ts:1-2`):

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck — restored from the last good build; public fns below stay typed.
```

TypeScript checks nothing *inside* this file, though exported signatures are
still honoured by consumers. The trap: add a field to a declared return type,
forget it in the returned object, and `npm run typecheck` passes while the field
is `undefined` at runtime. For every field you add, grep for it in **both** the
type and the value, and confirm it in the browser Network tab before calling a
step done.

### The table exists, unused

Plan 006 added:

```sql
create table if not exists ff_queue (
  league_id text not null,
  roster_id int not null,
  player_id text not null,
  rank int not null,
  primary key (league_id, roster_id, player_id)
);
create index if not exists ff_queue_order_idx on ff_queue (league_id, roster_id, rank);
```

### What autopick takes today

`nextAutopick(rosterId, byRoster, ranked, taken)`
(`src/lib/league/engine.server.ts:348-...`) counts what a roster already has and
walks a needs list:

```ts
function nextAutopick(rosterId, byRoster, ranked, taken) {
	const have = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
	for (const id of byRoster.get(rosterId) ?? []) {
		const pos = getPlayer(id)?.position;
		if (pos && have[pos] != null) have[pos] += 1;
	}
	const available = ranked.filter((p) => !taken.has(p.player_id));
	if (!available.length) return null;
	const needs = [];
	if (have.QB < 1) needs.push("QB");
	if (have.RB < 2) needs.push("RB");
	if (have.WR < 2) needs.push("WR");
	// …
```

Plan 008 extracted the surrounding lookup into `autopickFor(leagueId, rosterId)`,
called by both `flushHousePicks` and `expireDraftPicks`. **That is the single
function this plan modifies.**

### Server-fn convention

Mutations are `createServerFn({ method: "POST" })` with `authMiddleware`, a
`zod` validator, and a thin handler delegating to the engine — see `makePick`
(`src/lib/league/fns.ts:76-83`). Match it.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `npm run typecheck` | exit 0              |
| Tests     | `npm test`          | all pass            |
| Build     | `npm run build`     | exit 0              |
| Dev       | `npm run dev`       | serves on :8080     |

No new packages.

## Scope

**In scope**:
- `src/lib/league/engine.server.ts` — queue read/write helpers; `autopickFor`
  consults the queue; `loadDraft` returns the queue
- `src/lib/league/fns.ts` — `queueAdd`, `queueRemove`, `queueReorder`
- `src/routes/league/$leagueId/draft.tsx` — the queue panel and Queue buttons

**Out of scope** (do NOT touch):
- `nextAutopick` itself — it stays as the fallback when the queue is empty or
  exhausted. Do not rewrite its needs logic.
- `flushHousePicks` — an unowned seat has no manager and therefore no queue. It
  keeps using best-available. Do not give house seats a queue.
- Drag-and-drop libraries. Reorder with up/down buttons; no new dependency.
- `ff_queue` schema — plan 006 owns it.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: draft from a queue when autopicking`

## Steps

### Step 1: Queue helpers in the engine

Add to `engine.server.ts`:

```ts
/** A manager's wish list, best first. Unavailable players are filtered by the caller. */
export async function loadQueue(leagueId: string, rosterId: number) {
	const sql = await getSql();
	const rows = await sql`
    select player_id, rank from ff_queue
    where league_id = ${leagueId} and roster_id = ${rosterId}
    order by rank asc
  `;
	return rows.map((r) => ({
		playerId: r.player_id,
		rank: r.rank,
		player: getPlayer(r.player_id),
	}));
}

export async function queueAdd(userId: string, leagueId: string, playerId: string): Promise<void> {
	const mine = (await getRosters(leagueId)).find((r) => r.owner_id === userId);
	if (!mine) throw new Error("You don't have a seat.");
	if (!getPlayer(playerId)) throw new Error("Unknown player.");
	const sql = await getSql();
	const last = (await sql`
    select coalesce(max(rank), 0) as n from ff_queue
    where league_id = ${leagueId} and roster_id = ${mine.roster_id}
  `)[0];
	await sql`
    insert into ff_queue (league_id, roster_id, player_id, rank)
    values (${leagueId}, ${mine.roster_id}, ${playerId}, ${(last?.n ?? 0) + 1})
    on conflict do nothing
  `;
}

export async function queueRemove(userId: string, leagueId: string, playerId: string): Promise<void> {
	const mine = (await getRosters(leagueId)).find((r) => r.owner_id === userId);
	if (!mine) throw new Error("You don't have a seat.");
	const sql = await getSql();
	await sql`
    delete from ff_queue
    where league_id = ${leagueId} and roster_id = ${mine.roster_id} and player_id = ${playerId}
  `;
}

/** Rewrite the whole order. Simpler and less racy than swapping two ranks. */
export async function queueReorder(userId: string, leagueId: string, playerIds: string[]): Promise<void> {
	const mine = (await getRosters(leagueId)).find((r) => r.owner_id === userId);
	if (!mine) throw new Error("You don't have a seat.");
	const sql = await getSql();
	for (let i = 0; i < playerIds.length; i++) {
		await sql`
      update ff_queue set rank = ${i + 1}
      where league_id = ${leagueId} and roster_id = ${mine.roster_id}
        and player_id = ${playerIds[i]}
    `;
	}
}
```

**Verify**: `grep -n "export async function queue" src/lib/league/engine.server.ts`
→ three matches. `npm run typecheck` → exit 0.

### Step 2: Autopick consults the queue first

Modify `autopickFor(leagueId, rosterId)` (added by plan 008) so it takes the
first queued player who is still available, and only falls back to
`nextAutopick` when the queue yields nothing:

```ts
	// The queue is the manager's stated order, so it wins. Best-available is the
	// fallback for an empty queue — which, on sticky autodraft, is how a roster
	// ends up with five running backs.
	const queued = await loadQueue(leagueId, rosterId);
	for (const q of queued) {
		if (!taken.has(q.playerId) && q.player) return q.player;
	}
	return nextAutopick(rosterId, byRoster, ranked, taken);
```

`taken`, `byRoster` and `ranked` are already computed inside `autopickFor`.

Do **not** remove a player from `ff_queue` when he is drafted — by you or by
anyone. `loadQueue`'s consumers filter on availability, and keeping the row
means a queue survives a player being taken and re-added later in a mock. The
UI filters drafted players out for display.

**Verify**: `grep -n "loadQueue" src/lib/league/engine.server.ts` → definition
plus a call inside `autopickFor`. `npm run typecheck` → exit 0.

### Step 3: Return the queue from `loadDraft`

Add to the return type and value:

```ts
  /** The viewer's queue, still-available entries first. Empty when no seat. */
  queue: { playerId: string; name: string; position: string | null; team: string | null }[];
```

Populate it from `loadQueue(leagueId, mine)` when `mine` is set, filtering out
players in the existing `taken` set. Return `[]` when there is no seat.

**Verify**: `grep -n "queue" src/lib/league/engine.server.ts` shows the field in
both the type and the returned object. Then in `npm run dev`, the `getDraft`
response body contains a `queue` array — check the Network tab, because
`@ts-nocheck` will not catch a missing field.

### Step 4: Server fns

Add three to `src/lib/league/fns.ts`, matching the `makePick` shape exactly:

```ts
export const queueAdd = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string(), playerId: z.string() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.queueAdd(context.userId, data.leagueId, data.playerId);
    return { ok: true };
  });
```

…and the same for `queueRemove` and `queueReorder`
(`z.object({ leagueId: z.string(), playerIds: z.array(z.string()) })`).

**Verify**: `grep -c "queueAdd\|queueRemove\|queueReorder" src/lib/league/fns.ts`
→ at least 6 (three exports, three engine calls). `npm run typecheck` → exit 0.

### Step 5: The queue panel

In `draft.tsx`:

- Add a **Queue** button to each row of the available-players list, next to the
  existing Draft button. Calls `queueAdd`, invalidates `["draft", leagueId]`.
- Add a **Your queue** panel listing `d.queue` in order, each row with ↑ / ↓
  (calling `queueReorder` with the reordered id array) and × (`queueRemove`).
- Under the panel, one line of copy stating plainly that the top of the queue is
  what autodraft takes. After plan 009 this is load-bearing information, not a
  hint.

Reuse the existing `invalidate()` helper in that file. Buttons are `Button` from
`@/components/ui/button`.

**Verify**: `npm run build` → exit 0. In `npm run dev`: queueing a player makes
him appear in the panel; ↑/↓ reorders and survives a refetch; × removes him.

## Test plan

- No new automated tests. `npm test` runs `node --test 'scripts/**/*.test.mjs'`
  (`package.json`) — build scripts only. There is no engine or DB harness in this
  repo and this plan does not add one.
- Manual, with a hosted league in `npm run dev`:
  1. Queue three players. They appear in order.
  2. Turn autodraft on (plan 009's toggle). Your next pick takes the **top** of
     the queue, not best-available.
  3. Let someone else draft your top queued player, then let your pick fire. It
     takes the **second** entry.
  4. Empty the queue and let a pick fire. It falls back to best-available and
     does not error.
  5. A house (unowned) seat still autopicks best-available — unchanged.
- `npm test` stays green.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `autopickFor` consults `loadQueue` before `nextAutopick`
- [ ] `nextAutopick`'s body is unmodified (`git diff` shows no change inside it)
- [ ] `loadDraft` returns `queue`, confirmed in the browser Network tab
- [ ] `queueAdd` / `queueRemove` / `queueReorder` exist in both
      `engine.server.ts` and `fns.ts`
- [ ] Manual tests 2, 3 and 4 pass
- [ ] No new npm dependency (`git diff package.json` is empty)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 010 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `ff_queue` does not exist — plan 006 has not landed.
- `autopickFor` does not exist — plan 008 has not landed. Do not add queue
  logic directly to `flushHousePicks`; that would give house seats a queue they
  cannot have.
- `queueReorder`'s loop is slow enough to matter (a queue over ~50 entries).
  Report it rather than switching to a bulk `CASE` update mid-plan.
- Autopick starts taking a player who is already drafted. That means the `taken`
  set is not being consulted for queued entries — stop, because it corrupts the
  board rather than just picking badly.
- You are tempted to delete queue rows when a player is drafted. Do not; see
  step 2.

## Maintenance notes

- **The queue is per league, not per draft.** A second draft in the same league
  (a later season, if that is ever added) would inherit it. That is probably
  wrong and is deliberately not solved here — note it if seasons are added.
- **Plan 012 (mock mode) reuses this panel** against in-memory state. Keep the
  queue UI reading from `d.queue` rather than fetching for itself, so the mock
  can supply a different array with no component change.
- A reviewer should check that `nextAutopick` is untouched and that the fallback
  still fires — a queue bug that silently stops autopick would hang a draft on
  every expired clock.
- Deferred: a "queue best available" bulk button, and warning a manager who
  turns on autodraft with an empty queue. Both are good; neither is required for
  this to be correct.
