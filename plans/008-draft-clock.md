# Plan 008: Draft clock — 90 seconds a pick, advanced by whoever is looking

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9948a37..HEAD -- src/lib/league/engine.server.ts src/lib/league/ops.server.ts src/routes/league/\$leagueId/draft.tsx migrations/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/006 (needs `ff_draft.pick_deadline` and `pick_seconds`)
- **Category**: direction
- **Planned at**: commit `9948a37`, 2026-08-17

## Why this matters

A draft with no clock stalls on whoever walks away from their laptop. 90 seconds
a pick is the locked decision. The hard part is not the countdown — it is *who
advances the board when the time runs out*, in an app with no socket layer and
one hourly cron.

This is the step most likely to be got wrong, so it is specified tightly. Read
"The expiry problem" below before writing any code.

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

### The clock does not exist

`ff_draft` after plan 006 has `pick_deadline timestamptz` and
`pick_seconds int not null default 90`. Nothing reads or writes them yet.

### Where the pick advances today

`claimPick` is the single place the board moves forward
(`src/lib/league/engine.server.ts:953-970`):

```ts
async function claimPick(leagueId, pick, playerId) {
	const sql = await getSql();
	if ((await sql`select player_id from ff_picks where league_id = ${leagueId} and player_id = ${playerId}`)[0]) throw new Error("Already drafted.");
	if (!getPlayer(playerId)) throw new Error("Unknown player.");
	await sql`
    update ff_picks set player_id = ${playerId}, picked_at = ${(/* @__PURE__ */ new Date()).toISOString()}
    where league_id = ${leagueId} and pick_no = ${pick.pick_no}
  `;
	await sql`
    insert into ff_spots (league_id, roster_id, player_id, slot, starter_slot)
    values (${leagueId}, ${pick.roster_id}, ${playerId}, ${"bench"}, ${null})
  `;
	const next = (await sql`
      select * from ff_picks where league_id = ${leagueId} and player_id is null
      order by pick_no limit 1
    `)[0];
	if (!next) await finishDraft(leagueId);
	else await sql`update ff_draft set pick_no = ${next.pick_no} where league_id = ${leagueId}`;
}
```

`startDraft` opens the board (`engine.server.ts:841-851`):

```ts
export async function startDraft(userId: string, leagueId: string): Promise<void> {
	const league = await getLeague(leagueId);
	if (league.commish_id !== userId) throw new Error("Only the commissioner can open the draft.");
	if (league.locked) throw new Error("This desk is locked.");
	if (league.status !== "pre_draft") throw new Error("Draft already started.");
	await (await import("./ops.server")).ensureDraftBoard(leagueId);
	const sql = await getSql();
	await sql`update ff_draft set status = ${"live"}, pick_no = ${1} where league_id = ${leagueId}`;
	await sql`update ff_leagues set status = ${"drafting"} where id = ${leagueId}`;
	await flushHousePicks(leagueId);
}
```

### The only background job

`vercel.json` runs `/api/league/tick` on `15 * * * *` — **hourly**.
`src/routes/api/league/tick.ts` calls `ops.startLeagueClock()` and
`ops.tickAllLeagues()`. `startLeagueClock` (`ops.server.ts:827-835`) also sets a
5-minute in-process interval, but that only exists while a server instance is
warm and cannot be relied on for a draft.

### The page already polls

`src/routes/league/$leagueId/draft.tsx:29-33` refetches `getDraft` every 4s
while `status === "live"`.

### Existing autopick machinery to reuse

`flushHousePicks` (`engine.server.ts:1001-1026`) already loops picking for
**unowned** seats using `nextAutopick`. Do not duplicate that logic; this plan
adds an expiry path that calls the same `claimPick`.

## The expiry problem

A `pick_deadline` is only useful if something acts on it.

- **Cron only** → hourly. A board can sit dead for up to 59 minutes. Unusable.
- **Client timers firing the advance** → ten browsers race to advance the same
  pick; you need conditional writes anyway, and a closed laptop stops the draft.
- **Sockets** → a whole new transport for one screen.

**The decision: check expiry inside `loadDraft`.** Anyone who opens or polls the
draft page advances a stalled board, and during a live draft ten people poll it
every 4 seconds. The cron stays as the backstop for when literally nobody is
looking. This keeps the draft on the same polling model as live scoring.

**The race this creates must be handled.** Two clients can observe the same
expired deadline in the same instant. Every advance must be a **conditional
write** — update `where pick_no = <the value you read>` — so the second writer
affects zero rows instead of double-advancing. This is the same first-write-wins
pattern already used elsewhere in the repo (see the wager and trade paths in
`src/lib/league/wagers.server.ts` and `ops.server.ts`).

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
- `src/lib/league/engine.server.ts` — stamp the deadline in `claimPick` and
  `startDraft`; add an `expirePick` helper; call it from `loadDraft`; return
  clock fields
- `src/lib/league/ops.server.ts` — call the same expiry from `tickLeague` as a
  backstop
- `src/routes/league/$leagueId/draft.tsx` — render the countdown
- `src/components/draft-board.tsx` — only if the on-clock cell needs the
  remaining time; optional

**Out of scope** (do NOT touch):
- `flushHousePicks` / `autoFillDraft` — reuse, do not modify. `flushHousePicks`
  handles *unowned* seats; expiry handles *owned* ones. Keep them separate.
- `ff_rosters.autodraft` — plan 009 sets it. This plan makes an expired pick
  autopick **once**; it does not make it sticky.
- `ff_queue` — plan 010.
- The poll interval in `draft.tsx` (4s). Leave it.
- Any new dependency, timer library, or socket transport.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: put a clock on the draft`

## Steps

### Step 1: Stamp a deadline whenever the pick advances

Add a helper next to `claimPick` in `engine.server.ts`:

```ts
/**
 * Seconds a manager gets, from ff_draft.pick_seconds. Falls back to 90 for
 * rows written before plans/006 landed.
 */
async function stampDeadline(leagueId, pickNo) {
	const sql = await getSql();
	await sql`
    update ff_draft
    set pick_deadline = now() + (coalesce(pick_seconds, 90) || ' seconds')::interval
    where league_id = ${leagueId} and pick_no = ${pickNo}
  `;
}
```

Call it:
- at the end of `startDraft`, after `flushHousePicks(leagueId)`, for whatever
  `pick_no` is current at that point (re-read `ff_draft` — `flushHousePicks` may
  have advanced past unowned seats);
- in `claimPick`, in the `else` branch after `update ff_draft set pick_no = ...`,
  for `next.pick_no`.

When the draft finishes (`finishDraft`), clear it: `set pick_deadline = null`.

**Verify**: `grep -n "stampDeadline" src/lib/league/engine.server.ts` → three
call sites plus the definition. `npm run typecheck` → exit 0.

### Step 2: Add the expiry helper

Add to `engine.server.ts`, exported so `ops.server.ts` can call it:

```ts
/**
 * Advance the board if the pick on the clock has run out of time.
 *
 * Called from loadDraft — so whoever is looking at the draft keeps it moving —
 * and from tickLeague as the backstop for when nobody is. Both paths are safe
 * to run concurrently: the write is conditional on the pick number that was
 * read, so a second caller affects zero rows instead of skipping a pick.
 *
 * Returns the number of picks it advanced, for logging and tests.
 */
export async function expireDraftPicks(leagueId: string): Promise<number> {
	const sql = await getSql();
	let advanced = 0;
	for (let guard = 0; guard < 50; guard++) {
		const draft = (await sql`select * from ff_draft where league_id = ${leagueId}`)[0];
		if (!draft || draft.status !== "live" || !draft.pick_deadline) return advanced;
		if (new Date(draft.pick_deadline).getTime() > Date.now()) return advanced;

		// Claim the right to act on this pick. If another request got here first,
		// this affects zero rows and we stop rather than advancing twice.
		const claimed = await sql`
      update ff_draft set pick_deadline = null
      where league_id = ${leagueId} and pick_no = ${draft.pick_no}
        and pick_deadline is not null
      returning pick_no
    `;
		if (!claimed[0]) return advanced;

		const pick = (await sql`
      select * from ff_picks where league_id = ${leagueId} and pick_no = ${draft.pick_no}
    `)[0];
		if (!pick || pick.player_id) return advanced;

		const player = await autopickFor(leagueId, pick.roster_id);
		if (!player) return advanced;
		await claimPick(leagueId, pick, player.player_id);
		advanced += 1;
	}
	return advanced;
}
```

`autopickFor` is a small extraction of the body already inside
`flushHousePicks` (`engine.server.ts:1010-1024`) — the `taken` set, the
`byRoster` map, and `nextAutopick`. Extract it as a helper and have
`flushHousePicks` call it too, so there is one autopick implementation. Do not
change `flushHousePicks`'s behaviour otherwise.

The `guard < 50` bound matches the existing loops (`flushHousePicks` uses 200,
`autoFillDraft` 220) and prevents a runaway if a deadline is somehow always in
the past.

**Verify**: `npm run typecheck` → exit 0.
`grep -c "nextAutopick(" src/lib/league/engine.server.ts` → the call count does
not increase (it moved into `autopickFor`, it was not duplicated).

### Step 3: Call expiry from the read path

At the top of `loadDraft`, after `const league = await getLeague(leagueId)`:

```ts
	// Whoever is looking at the draft keeps it moving. There is no socket layer
	// and the cron is hourly, so a deadline nobody acts on would stall the board.
	try {
		await expireDraftPicks(leagueId);
	} catch {
		// A stuck autopick must not make the draft page unreadable.
	}
```

Then read `ff_draft` **after** that call, not before, so the returned `pickNo`
reflects any advance.

Add clock fields to the return type and value:

```ts
  pickDeadline: string | null;
  pickSeconds: number;
```

taken from the `draft` row (`draft?.pick_deadline ?? null`,
`draft?.pick_seconds ?? 90`).

**Verify**: `npm run typecheck` → exit 0.
`grep -n "expireDraftPicks" src/lib/league/engine.server.ts` → definition plus a
call inside `loadDraft`.

### Step 4: Backstop from the cron

In `src/lib/league/ops.server.ts`, inside `tickLeague`, call the same helper.
Find where `tickLeague` already does per-league work and add:

```ts
  try {
    const { expireDraftPicks } = await import("./engine.server");
    await expireDraftPicks(leagueId);
  } catch {
    /* a stuck draft must not stop the week clock */
  }
```

Use a dynamic import — `ops.server.ts` and `engine.server.ts` already import
each other dynamically to avoid a cycle (grep `await import("./engine.server")` in `ops.server.ts` for the pattern).

**Verify**: `grep -n "expireDraftPicks" src/lib/league/ops.server.ts` → one
call. `npm run typecheck` → exit 0.

### Step 5: Show the countdown

In `draft.tsx`, render the remaining time next to the on-clock team. Compute it
client-side from `pickDeadline` with a 1s `setInterval`, clearing on unmount.
Do **not** fire any mutation when it hits zero — the next 4s poll advances the
board via step 3. The client only *displays* time.

Style: `font-mono`, `tabular-nums`, and `text-loss` under 20 seconds. Show
`--:--` when `pickDeadline` is null.

**Verify**: `npm run build` → exit 0. Then `npm run dev` and open a live draft:
the number counts down once per second and does not jump backwards between
polls.

## Test plan

- No new automated tests. `npm test` runs `node --test 'scripts/**/*.test.mjs'`
  (`package.json`), which covers build scripts; there is no engine or DB test
  harness in this repo and this plan does not add one.
- Manual, with a hosted league in `npm run dev`:
  1. Start the draft. The on-clock team shows ~1:30 counting down.
  2. Let it reach zero without picking. Within one poll (4s) the board advances
     and a player is on that roster.
  3. Open the same draft in **two** browser windows and let a pick expire. Exactly
     one pick advances — not two. This is the race check and it is the most
     important manual test in this plan.
  4. Make a pick manually before expiry. The clock resets to ~1:30 for the next
     team.
- `npm test` stays green.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `expireDraftPicks` is exported from `engine.server.ts` and called from
      both `loadDraft` and `tickLeague`
- [ ] The advance is conditional: `grep -n "pick_deadline is not null" src/lib/league/engine.server.ts`
      matches inside `expireDraftPicks`
- [ ] `loadDraft` returns `pickDeadline` and `pickSeconds`
- [ ] There is exactly one autopick implementation (`autopickFor`), called by
      both `flushHousePicks` and `expireDraftPicks`
- [ ] Two simultaneous windows do not double-advance a pick (manual test 3)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 008 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `ff_draft.pick_deadline` or `pick_seconds` does not exist — plan 006 has not
  landed. Do not add the columns here.
- The conditional update in step 2 does not support `returning` on this
  database. PGLite and Neon both do; if it fails, report it rather than
  switching to a read-then-write, which reintroduces the race.
- Manual test 3 double-advances. Do **not** paper over it with a client-side
  lock or a delay — report the observed behaviour. A draft that skips picks is
  worse than a draft with no clock.
- `expireDraftPicks` inside `loadDraft` makes the draft page noticeably slower,
  or you observe it firing on non-live drafts. It should return immediately when
  `status !== "live"` or `pick_deadline` is null.
- You find yourself wanting to change `flushHousePicks`'s behaviour to make this
  work. Extraction is fine; behaviour change is not.

## Maintenance notes

- **Expiry-on-read is the load-bearing decision.** If sockets are ever added,
  this becomes redundant but harmless — leave it as the fallback rather than
  removing it.
- **Plan 009 makes expiry sticky.** After it, an expired pick also sets
  `ff_rosters.autodraft = 1`, and rosters with that flag skip the clock entirely.
  The helper written here is the hook point.
- **Plan 010 changes what an expired pick takes** — the queue first, then best
  available. `autopickFor` is the function it will modify.
- `pick_seconds` has no settings UI. Every league gets 90s until one is added;
  that is deliberate and noted in plan 006.
- A reviewer should scrutinise: the conditional write, that `loadDraft` reads
  `ff_draft` *after* expiry, and that the client never mutates on zero.
