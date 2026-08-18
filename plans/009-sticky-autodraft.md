# Plan 009: Sticky autodraft — a missed clock puts you on autopick until you say otherwise

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9948a37..HEAD -- src/lib/league/engine.server.ts src/lib/league/fns.ts src/routes/league/\$leagueId/draft.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/006 (needs `ff_rosters.autodraft`), plans/008 (needs
  `expireDraftPicks` and `autopickFor`)
- **Category**: direction
- **Planned at**: commit `9948a37`, 2026-08-17

## Why this matters

Plan 008 makes an expired pick autopick once. That is not enough: a manager who
missed one pick because they walked away is usually gone for the next one too,
so a per-pick autopick means the draft stalls for the full 90 seconds *every
round* on the same absent person. Ten rounds of that is fifteen minutes of dead
air.

The locked decision: **running out of time turns autodraft on and leaves it on**
until the manager turns it off. A roster with the flag set never starts a clock
— it picks immediately. A manager can also switch it on deliberately before
stepping away.

## Current state

### ⚠ `engine.server.ts` is `@ts-nocheck`

The file begins (`src/lib/league/engine.server.ts:1-2`):

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck — restored from the last good build; public fns below stay typed.
```

**This changes how you verify.** TypeScript will not check anything *inside*
this file. The exported signatures are still honoured by *consumers*, which
creates a specific trap: you can add a field to a function's declared return
type, forget to add it to the returned object, and `npm run typecheck` will pass
while the field is `undefined` at runtime.

So for every field you add to a `loadDraft`-style return:

1. add it to the **type annotation**, and
2. add it to the **returned object**, and
3. grep for both, and
4. confirm it is actually present at runtime in the browser (Network tab → the
   `getDraft` response body) before calling the step done.

Do not treat a green typecheck as proof that an engine change is correct.

### The flag exists but nothing reads it

Plan 006 added `ff_rosters.autodraft int not null default 0`. No code reads or
writes it.

### Where expiry happens

Plan 008 added `expireDraftPicks(leagueId)` to
`src/lib/league/engine.server.ts`. It advances the board when
`ff_draft.pick_deadline` has passed, using a conditional write to survive
concurrent callers, and picks via `autopickFor(leagueId, rosterId)`.

### Where the deadline is stamped

Plan 008 added `stampDeadline(leagueId, pickNo)`, called from `startDraft` and
from `claimPick` when the board advances.

### Existing server-fn convention

Mutations live in `src/lib/league/fns.ts` as `createServerFn({ method: "POST" })`
with `authMiddleware`, a `zod` validator, and a thin handler that delegates to
the engine. Example (`src/lib/league/fns.ts:76-83`):

```ts
export const makePick = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string(), playerId: z.string() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.makePick(context.userId, data.leagueId, data.playerId);
    return { ok: true };
  });
```

Match this exactly for the new toggle.

### How the roster row is found

Ownership is `ff_rosters.owner_id = userId`. See
`engine.server.ts:1060` inside `startPlayer`:

```ts
	const mine = (await getRosters(leagueId)).find((r) => r.owner_id === userId);
	if (!mine) throw new Error("You don't have a seat.");
```

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
- `src/lib/league/engine.server.ts` — set the flag on expiry; skip the clock for
  flagged rosters; add `setAutodraft`; return the flag from `loadDraft`
- `src/lib/league/fns.ts` — a `setAutodraft` server fn
- `src/routes/league/$leagueId/draft.tsx` — the toggle and its state

**Out of scope** (do NOT touch):
- `flushHousePicks` — it handles seats with **no owner**. Autodraft is for seats
  that have one. Two different situations; keep them separate.
- `autoFillDraft` — the commissioner's "fill the whole board" button. Unrelated.
- `ff_queue` — plan 010 changes *what* autopick takes. This plan only changes
  *when* it fires.
- Clearing the flag automatically at the end of the draft. It is per-league and
  harmless afterwards; a later draft in a later season gets a fresh row.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: keep a manager on autodraft after a missed pick`

## Steps

### Step 1: Set the flag when a pick expires

In `expireDraftPicks` (`engine.server.ts`), after the conditional claim succeeds
and before calling `autopickFor`, set the flag for the roster that just ran out
of time:

```ts
		// Sticky on purpose: someone who missed this pick is usually still away
		// for the next one, and a 90-second stall every round is worse for the
		// nine people who are present than an autopick is for the one who is not.
		await sql`
      update ff_rosters set autodraft = 1
      where league_id = ${leagueId} and roster_id = ${pick.roster_id}
    `;
```

**Verify**: `grep -n "set autodraft = 1" src/lib/league/engine.server.ts` →
one match, inside `expireDraftPicks`. `npm run typecheck` → exit 0.

### Step 2: A flagged roster never starts a clock

The point of the flag is that the draft does not wait. In `stampDeadline`, do
not stamp a deadline for a roster that is on autodraft — instead leave
`pick_deadline` null and let the caller pick immediately.

Change `stampDeadline` to take the roster and return whether it stamped:

```ts
/**
 * Give this pick a deadline, unless the seat is on autodraft — those pick
 * immediately rather than making nine people wait ninety seconds for a
 * decision that is already automated.
 *
 * Returns false when no clock was started, which is the caller's signal to
 * autopick right away.
 */
async function stampDeadline(leagueId, pickNo, rosterId) {
	const sql = await getSql();
	const seat = (await sql`
    select autodraft, owner_id from ff_rosters
    where league_id = ${leagueId} and roster_id = ${rosterId}
  `)[0];
	if (!seat || !seat.owner_id || seat.autodraft) {
		await sql`update ff_draft set pick_deadline = null where league_id = ${leagueId}`;
		return false;
	}
	await sql`
    update ff_draft
    set pick_deadline = now() + (coalesce(pick_seconds, 90) || ' seconds')::interval
    where league_id = ${leagueId} and pick_no = ${pickNo}
  `;
	return true;
}
```

Note it also returns false for an **unowned** seat — `flushHousePicks` already
fills those, and giving a house seat a clock would stall the board for nobody.

Update both call sites to pass the roster id and, when it returns false, run the
autopick loop. The simplest correct shape: after `claimPick` advances to `next`,
call `stampDeadline(leagueId, next.pick_no, next.roster_id)` and if it returns
false, call `flushAutodraft(leagueId)` — a small loop that repeatedly autopicks
while the seat on the clock is flagged or unowned, bounded by a guard like the
existing loops.

**Verify**: `npm run typecheck` → exit 0.
`grep -n "stampDeadline(" src/lib/league/engine.server.ts` → every call passes
three arguments.

### Step 3: Expose and toggle the flag

Add to `loadDraft`'s return type and value:

```ts
  /** True when the viewer's own seat is on autodraft. */
  myAutodraft: boolean;
```

sourced from the roster whose `owner_id === userId` (the `mine` lookup already
in `loadDraft`).

Add the engine function:

```ts
export async function setAutodraft(userId: string, leagueId: string, on: boolean): Promise<void> {
	const mine = (await getRosters(leagueId)).find((r) => r.owner_id === userId);
	if (!mine) throw new Error("You don't have a seat.");
	const sql = await getSql();
	await sql`
    update ff_rosters set autodraft = ${on ? 1 : 0}
    where league_id = ${leagueId} and roster_id = ${mine.roster_id}
  `;
	// Turning it off mid-draft should give you the clock back if you are up.
	if (!on) {
		const draft = (await sql`select * from ff_draft where league_id = ${leagueId}`)[0];
		if (draft?.status === "live") {
			const pick = (await sql`
        select * from ff_picks where league_id = ${leagueId} and pick_no = ${draft.pick_no}
      `)[0];
			if (pick && !pick.player_id && pick.roster_id === mine.roster_id) {
				await stampDeadline(leagueId, pick.pick_no, pick.roster_id);
			}
		}
	}
}
```

Add the server fn in `src/lib/league/fns.ts`, matching the `makePick` shape:

```ts
export const setAutodraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ leagueId: z.string(), on: z.boolean() }))
  .handler(async ({ context, data }) => {
    const eng = await import("./engine.server");
    await eng.setAutodraft(context.userId, data.leagueId, data.on);
    return { ok: true };
  });
```

**Verify**: `npm run typecheck` → exit 0.
`grep -n "setAutodraft" src/lib/league/fns.ts` → one export.

### Step 4: The toggle in the draft page

In `draft.tsx`, add a toggle near the on-clock line. It must:

- read its state from `d.myAutodraft`;
- call the `setAutodraft` mutation and invalidate `["draft", leagueId]` on
  success (the file already has an `invalidate()` helper — use it);
- read clearly in **both** states. When on, say so plainly and make turning it
  off the obvious action — a manager who was auto-drafted needs to find this
  without hunting.

Use `Button` from `@/components/ui/button` with `variant="outline"`, matching
the existing buttons in that file.

**Verify**: `npm run build` → exit 0. In `npm run dev`, toggling flips the label
and survives a refetch.

## Test plan

- No new automated tests. `npm test` runs `node --test 'scripts/**/*.test.mjs'`
  (`package.json`) — build scripts only; there is no engine or DB harness and
  this plan does not add one.
- Manual, with a hosted league in `npm run dev`:
  1. Start a draft, let your pick expire. A player is added **and** the toggle
     now reads as on.
  2. The next time your turn comes round, it picks immediately — no 90-second
     wait for you, and the clock does not appear for your seat.
  3. Turn the toggle off while it is not your turn. Your next turn shows a full
     clock.
  4. Turn it off **while you are on the clock** during an autodraft run: you get
     a deadline stamped and the board waits for you.
  5. A seat with no owner still autopicks via `flushHousePicks` exactly as
     before — this plan must not change house behaviour.
- `npm test` stays green.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `expireDraftPicks` sets `autodraft = 1` for the roster that timed out
- [ ] `stampDeadline` takes a roster id and returns false for flagged **and**
      unowned seats
- [ ] `loadDraft` returns `myAutodraft`
- [ ] `setAutodraft` exists in both `engine.server.ts` and `fns.ts`
- [ ] Turning autodraft off while on the clock re-stamps a deadline (manual 4)
- [ ] `flushHousePicks` is unmodified (`git diff` shows no change to its body)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 009 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `ff_rosters.autodraft` does not exist — plan 006 has not landed.
- `expireDraftPicks` or `stampDeadline` is missing — plan 008 has not landed.
  Do not write your own clock here.
- The autodraft loop in step 2 can run away — if you cannot bound it with a
  guard the way `flushHousePicks` does (`for (let guard = 0; guard < 200; …)`),
  report it. An unbounded loop over a draft board will hang a request.
- Turning autodraft **on** for the seat currently on the clock causes a pick to
  be made instantly from inside the toggle's own request. Decide deliberately:
  the safer behaviour is that the next poll picks it up via `expireDraftPicks`,
  not that a settings toggle drafts a player synchronously. If you find it
  drafting inside the toggle, report it.
- You are tempted to clear `autodraft` automatically anywhere. Only the manager
  clears it — that is the locked decision.

## Maintenance notes

- **This makes the queue load-bearing.** Once a timeout can hand a whole draft
  to autopick, what autopick *takes* stops being a detail. Plan 010 adds the
  queue and should be treated as a companion to this plan, not an optional
  extra — an empty queue on autodraft falls back to best-available, which is how
  a roster ends up with five running backs.
- **Two autopick paths now exist**: `flushHousePicks` (no owner) and the
  autodraft path (owner, flagged). They share `autopickFor` but fire under
  different conditions. Keep the distinction; merging them would make an unowned
  seat look like a manager who walked away.
- A reviewer should check that the flag is never cleared by code, and that
  `stampDeadline`'s false return is handled at every call site — a missed one
  means the board silently waits forever on an autodrafting seat.
