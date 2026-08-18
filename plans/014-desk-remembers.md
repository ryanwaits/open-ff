# Plan 014: The desk remembers — feed standing facts into the weekly write-up

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9948a37..HEAD -- src/lib/league/dispatch.ts src/lib/league/engine.server.ts src/lib/league/desk-voice.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/013 (needs `loadLeagueFacts`)
- **Category**: direction
- **Planned at**: commit `9948a37`, 2026-08-17

## Why this matters

Plan 013 computes standing facts — head-to-head records, waiver heartbreak,
bench regret, book streaks — and nothing consumes them. This plan hands them to
the desk.

The change is small and the payoff is the difference between a write-up that
describes this week and one that knows the league. "Masthead lost to Night Desk
by under a point for the third time" is only sayable if something remembers.

The risk is not technical. It is that more context makes the output *worse* —
longer, listier, or repeating the same fact every week. That is what the
verification in this plan is actually for.

## Current state

### The context the desk gets

`buildDispatchContext` in `src/lib/league/dispatch.ts:96` takes this week's
state and returns `DispatchContext`:

```ts
export function buildDispatchContext(input: {
  leagueId: string;
  leagueName: string;
  season: string;
  week: number;
  status: string;
  standings: StandingRow[];
  pairs: MatchupPair[];
  activity: ActivityItem[];
  rosters: RosterCard[];
}): DispatchContext {
```

It is **synchronous** and takes everything as arguments — it performs no I/O.
That is a property worth preserving: it makes the composer testable and keeps
database access in the caller.

`DispatchContext`'s shape (`dispatch.ts:15-43`):

```ts
export type DispatchContext = {
  leagueName: string;
  season: string;
  week: number;
  status: string;
  standings: Array<{ team: string; manager: string; wins: number; losses: number; ties: number; pf: number; pa: number }>;
  games: Array<{ home: string; away: string; homePts: number; awayPts: number; homeStud: …; awayStud: …; homeNames: string[]; awayNames: string[] }>;
  rosters: RosterCard[];
  moves: Array<{ type: string; teams: string[]; note: string }>;
  voice: DispatchVoice;
  teamNotes: Record<string, { note?: string }>;
};
```

### Where it is called

`src/lib/league/engine.server.ts (desk composition path)` (inside the desk composition path):

```ts
	const { buildDispatchContext, composeDesk } = await import("./dispatch");
```

…and the result is stored in `ff_dispatches.context_json`
(`engine.server.ts (ff_dispatches insert)`):

```ts
      insert into ff_dispatches (
        id, league_id, week, kind, slug, headline, dek, body_json, bullets_json, box_json, focus_json, context_json, source
```

### Regeneration

`loadDesk` (`engine.server.ts (loadDesk)`) returns an existing edition when one is
stored and only recomposes when the week has none, or when the stored one is a
placeholder:

```ts
	const stale =
		existing.length <= 1 &&
		existing.some((r) => /blank paper|still blank/i.test(String(r.headline)));
	if (existing.length >= 2 && !stale) {
```

**This matters for verification**: adding facts will not change an edition that
is already stored. You must delete the stored rows for a week to see a new one.

### What plan 013 provides

```ts
export async function loadLeagueFacts(leagueId: string, throughWeek: number): Promise<LeagueFacts>
// LeagueFact = { kind, teams: string[], text: string, data: Record<string, number|string> }
```

Facts are threshold-gated and the list is empty for a league with no history.

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
- `src/lib/league/dispatch.ts` — add `facts` to `DispatchContext` and to
  `buildDispatchContext`'s input; use them in composition
- `src/lib/league/engine.server.ts` — load facts at the call site and pass them
  in

**Out of scope** (do NOT touch):
- `src/lib/league/league-facts.server.ts` — plan 013 owns it. If a fact reads
  badly, note it; do not edit it here.
- `src/lib/league/desk-voice.ts` — the voice packs stay as they are.
- The `ff_dispatches` schema — `context_json` is already a text column and will
  carry the extra field with no migration.
- The regeneration rule in `loadDesk`. Do not make the desk recompose more
  eagerly to make testing easier; delete rows by hand instead.
- Making `buildDispatchContext` async. Keep it pure — the caller does the I/O.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: give the desk a memory`

## Steps

### Step 1: Carry facts through the context

In `src/lib/league/dispatch.ts`:

Add to `DispatchContext`:

```ts
  /**
   * Standing facts about the league's history, already threshold-gated by
   * loadLeagueFacts. Empty for a young league, which is correct — the desk
   * should say nothing rather than reach.
   */
  facts: Array<{ kind: string; teams: string[]; text: string }>;
```

Add `facts` to `buildDispatchContext`'s input parameter with the same type, and
pass it straight through to the returned object. Default it to `[]` when the
caller omits it, so nothing breaks if a call site is missed.

Keep the function synchronous.

**Verify**: `npm run typecheck` → exit 0.
`grep -n "facts" src/lib/league/dispatch.ts` → the type, the input, and the
returned object.

### Step 2: Load facts at the call site

In `src/lib/league/engine.server.ts`, at the desk composition path near line
1923, load facts alongside the existing inputs and pass them to
`buildDispatchContext`:

```ts
	// The week's snapshot says what happened; the facts say what it means in the
	// context of a season. Failing to load them must not stop an edition from
	// being written.
	let facts = [];
	try {
		const { loadLeagueFacts } = await import("./league-facts.server");
		facts = (await loadLeagueFacts(leagueId, week)).facts;
	} catch {
		/* a desk with no memory is still a desk */
	}
```

Then add `facts` to the object passed into `buildDispatchContext`.

**Verify**: `grep -n "loadLeagueFacts" src/lib/league/engine.server.ts` → one
call. `npm run typecheck` → exit 0.

### Step 3: Use them in composition — sparingly

Find where `composeDesk` turns context into articles in `dispatch.ts` and give
facts a **bounded** role:

- **At most two facts per edition.** Not a list, not a section — woven into the
  existing prose or used as a single aside.
- **Prefer facts whose `teams` appear in this week's `games`.** A fact about two
  teams who did not play is filler.
- **Never repeat a fact used in the previous week's edition.** The previous
  edition's `context_json` is retrievable at the call site; if wiring that
  through is more than a few lines, instead vary selection by seeding on the
  week number so consecutive weeks pick different facts. Say in a comment which
  approach you used and why.

Do not add a new article kind. Do not add a "league history" section. The
failure mode here is a desk that lists trivia, and the guard against it is the
cap.

**Verify**: `npm run build` → exit 0.

### Step 4: See it actually change an edition

Stored editions are not regenerated (see "Regeneration" above). To observe the
change you must delete the stored rows for a week:

```
npx vite-node -e "
  const { getSql } = await import('./src/lib/db.ts');
  const sql = await getSql();
  await sql\`delete from ff_dispatches where league_id = '<league id>' and week = <week>\`;
  console.log('cleared');
"
```

Then load the desk for that week in `npm run dev` and read the output.

**Verify**: the new edition mentions at most two historical facts, both about
teams that played this week, and reads as prose rather than a list. If the
league has no history, the edition should read exactly as it did before —
confirm that too, because an empty fact list must be a no-op.

Record both outputs (before and after) in your report.

## Test plan

- No new automated tests. `npm test` runs `node --test 'scripts/**/*.test.mjs'`
  (`package.json`) — build scripts only, and prompt output is not
  machine-checkable anyway.
- The verification for this plan is **reading two editions side by side**
  (step 4). That is a judgement call and it is the right one to make here:
  the risk is quality, not correctness.
- Check specifically:
  1. A league with history: at most two facts, relevant to this week's games.
  2. A league with no history: output unchanged from before this plan.
  3. Two consecutive weeks: they do not lead with the same fact.
- `npm test` stays green.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `DispatchContext` has `facts`; `buildDispatchContext` is still synchronous
- [ ] `loadLeagueFacts` is called at the composition site inside a `try` that
      cannot stop an edition being written
- [ ] Composition uses **at most two** facts per edition
- [ ] An empty fact list produces output identical to before this plan
      (verification 2)
- [ ] Before/after editions recorded in the report
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 014 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `loadLeagueFacts` does not exist — plan 013 has not landed.
- `buildDispatchContext` is no longer synchronous or no longer takes its inputs
  as arguments. Do not make it async to fit this plan; move the load to the
  caller, which is what step 2 does.
- The edition gets noticeably worse — longer, listier, or repeating itself. That
  is the failure this plan is guarding against. Report the output rather than
  tuning the prompt repeatedly; the fix may be a lower cap or better fact
  selection in plan 013, not more prompt text.
- You cannot make an edition regenerate. Do not change the `loadDesk`
  regeneration rule to work around it — delete the rows instead.

## Maintenance notes

- **The cap is the feature.** Two facts per edition is a deliberate ceiling; the
  temptation as more fact kinds land will be to raise it. Raising it turns the
  desk into a trivia column.
- **`context_json` now stores facts too**, so a stored edition records what it
  knew at the time. That is useful for the "do not repeat last week" rule and
  worth keeping even if selection changes.
- **Fact quality is upstream.** If the desk says something dull, the fix is
  usually a threshold in `league-facts.server.ts` (plan 013), not a prompt tweak
  here.
- A reviewer should read two consecutive editions from a league with real
  history and ask whether a person would have written either sentence. That is
  the only real acceptance test for this plan.
