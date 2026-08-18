# Plan 013: Derived league facts — roll the event ledger into things worth saying

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9948a37..HEAD -- src/lib/league/events.server.ts src/lib/league/dispatch.ts src/lib/league/engine.server.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (the ledger already exists and is accumulating)
- **Category**: direction
- **Planned at**: commit `9948a37`, 2026-08-17

## Why this matters

`ff_events` has been recording every consequential thing that happens in a
league — claims filed and lost with the reason, adds, drops, trades, lineup
changes, injury designations changing, wagers placed and settled — and
**nothing reads it**. That was deliberate: events can only be captured as they
happen, so the writer shipped first.

This plan is the other half. It rolls the raw ledger into a small set of
standing facts an LLM can actually be handed. Four months of raw events is
useless as a prompt; "Masthead is 0–4 against Night Desk, all by single digits"
is the thing that makes a write-up worth reading.

This plan produces the facts. Plan 014 feeds them to the desk. Splitting them
means this one can be verified on its own with no prompt-quality judgement.

## Current state

### The ledger, and its reader

`src/lib/league/events.server.ts` defines the table and both directions.
Event kinds today:

```ts
export type LeagueEventKind =
  | "claim_filed" | "claim_pulled" | "claim_won" | "claim_lost"
  | "free_agent_add" | "drop"
  | "trade_proposed" | "trade_accepted" | "trade_rejected" | "trade_cancelled"
  | "lineup_set" | "lineup_benched"
  | "injury_changed"
  | "wager_placed" | "wager_pulled" | "wager_won" | "wager_lost";
```

The row shape:

```sql
create table if not exists ff_events (
  id text primary key,
  league_id text not null,
  week int not null,
  kind text not null,
  actor_roster int,
  subject_roster int,
  player_id text,
  amount int,
  payload_json text not null default '{}',
  at timestamptz not null default now())
```

`readEvents(leagueId, { limit, sinceWeek })` already exists and returns
`StoredEvent[]` newest-first with `payload` parsed. Its doc comment says
outright that nothing consumes it yet — this plan is what it was waiting for.

### What the desk gets today

`buildDispatchContext` (`src/lib/league/dispatch.ts:96`) assembles a
**snapshot of the current week, rebuilt from scratch every week**: standings,
this week's games, the last twelve activity rows, rosters. Its type:

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

There is no memory in it. The desk cannot know this is the third one-point loss
to the same opponent, because nothing carries between weeks.

### Where week results live

Head-to-head and margin facts need finished scores. Those are in
`ff_week_results (league_id, week, roster_id, points, starters_json)` —
written when a week is finalised (see the insert in
`src/lib/league/ops.server.ts`, in the function that writes week results before
settling wagers). `starters_json` is
`[{ playerId, points }]`, which is what makes the benched-player fact possible.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `npm run typecheck` | exit 0              |
| Tests     | `npm test`          | all pass            |
| Build     | `npm run build`     | exit 0              |

No new packages.

## Scope

**In scope**:
- `src/lib/league/league-facts.server.ts` (create)

**Out of scope** (do NOT touch):
- `src/lib/league/events.server.ts` — the writer and `readEvents` are correct.
  Do not add event kinds in this plan; if a fact needs data that is not being
  recorded, note it and compute what you can.
- `src/lib/league/dispatch.ts` — plan 014 wires facts into the context. Keep
  this plan free of prompt changes so it can be verified numerically.
- Any table or migration. This plan only reads.
- Rewriting `buildDispatchContext`.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: roll league events into standing facts`

## Steps

### Step 1: Define the fact shape

Create `src/lib/league/league-facts.server.ts`. Facts are **sentences with
numbers attached**, not raw aggregates — the consumer is a language model, so a
fact that needs interpretation to be usable is not finished.

```ts
/**
 * Standing facts about a league, rolled up from ff_events and ff_week_results.
 *
 * The desk cannot be handed four months of raw events, and a bare aggregate
 * ("h2h: 4-0") still needs interpreting. So each fact carries both the numbers
 * and a plain sentence, and the consumer picks whichever it needs.
 */
export type LeagueFact = {
  /** Stable key so a consumer can prefer or suppress a kind of fact. */
  kind:
    | "head_to_head"
    | "close_losses"
    | "waiver_spend"
    | "waiver_heartbreak"
    | "bench_regret"
    | "book_record"
    | "injury_luck";
  /** Teams this is about, for attribution. */
  teams: string[];
  /** Plain sentence, already written. */
  text: string;
  /** The raw numbers behind it, so a consumer can re-phrase. */
  data: Record<string, number | string>;
};

export type LeagueFacts = {
  leagueId: string;
  throughWeek: number;
  facts: LeagueFact[];
};
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Compute the facts

Export one function:

```ts
export async function loadLeagueFacts(leagueId: string, throughWeek: number): Promise<LeagueFacts>
```

It reads `ff_week_results`, `ff_matchups`, `ff_rosters` and `readEvents`, then
computes each fact below. **Every fact must be omitted when its threshold is not
met** — an empty list is a correct answer for a league in week 1, and inventing
filler is worse than saying nothing.

| kind | Rule | Threshold |
|---|---|---|
| `head_to_head` | Record between two teams that have met more than once | ≥ 2 meetings |
| `close_losses` | A team's losses decided by under 5 points | ≥ 2 such losses |
| `waiver_spend` | Most FAAB spent on one player (`claim_won` with `amount`) | amount ≥ 15 |
| `waiver_heartbreak` | Times a manager lost a claim with `payload.reason === "outbid"` | ≥ 3 |
| `bench_regret` | A benched player outscored a starter at the same position, from `ff_week_results.starters_json` plus the roster | gap ≥ 8 points |
| `book_record` | A manager's `wager_won` / `wager_lost` tally | ≥ 3 settled wagers |
| `injury_luck` | `injury_changed` events on a manager's rostered players | ≥ 3 in a season |

Write each sentence in the app's existing register — plain, specific, no
exclamation marks. Read `src/lib/league/desk-voice.ts` first to match tone.

Bound the work: `readEvents(leagueId, { limit: 2000 })` is the cap already built
into that function; do not raise it.

**Verify**: `npm run typecheck` → exit 0.
`grep -c "kind:" src/lib/league/league-facts.server.ts` → at least 7 (one per
fact kind).

### Step 3: Prove it against a real league

There is no DB test harness, so verify by running the function directly with
`vite-node`, which the repo already has available via `npx`:

```
npx vite-node -e "
  process.chdir('.');
  const f = await import('./src/lib/league/league-facts.server.ts');
  const out = await f.loadLeagueFacts('<a hosted league id>', 18);
  console.log(JSON.stringify(out, null, 2));
"
```

**Verify**: it returns without throwing, `throughWeek` is 18, and `facts` is an
array. On a league with little history an **empty** array is the correct result
— confirm it does not invent facts. If you have a league with real history,
spot-check one fact's numbers against the database by hand.

Note in your report which league you ran it against and how many facts came
back.

### Step 4: Confirm it is read-only

```
grep -n "insert\|update\|delete" src/lib/league/league-facts.server.ts
```

**Verify**: no matches. This module only reads.

## Test plan

- No new automated tests in the default runner: `npm test` runs
  `node --test 'scripts/**/*.test.mjs'` (`package.json`), which globs
  `scripts/`, not `src/`. Adding `src/` to that glob is a build-tooling change
  and is out of scope here.
- The step 3 `vite-node` invocation **is** the verification for this plan. Record
  its output in your report.
- `npm test` stays green.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `src/lib/league/league-facts.server.ts` exports `loadLeagueFacts` and the
      `LeagueFact` / `LeagueFacts` types
- [ ] Every fact kind in the table above is implemented and threshold-gated
- [ ] The module performs no writes (step 4 grep is empty)
- [ ] Step 3 ran against a real league and its output is recorded in the report
- [ ] A league with no history returns `facts: []` rather than filler
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 013 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `ff_events` does not exist or `readEvents` is missing. The ledger is a
  prerequisite and this plan cannot substitute for it.
- `ff_week_results.starters_json` is not `[{ playerId, points }]`. The
  `bench_regret` fact depends on that shape; if it differs, implement the other
  six and report this one rather than guessing at the format.
- A fact needs an event kind that is not being recorded (for example, "who was
  on the clock longest" — there is no such event). Note it as a follow-up for
  the ledger; do not add event kinds here.
- `loadLeagueFacts` takes more than a couple of seconds on a real league. It
  will be called when a desk edition is composed, which is not hot, but a slow
  scan suggests an unbounded query — report it.

## Maintenance notes

- **Thresholds are the whole design.** A fact that fires on week 1 is noise, and
  noise is what makes generated writing feel generated. When adding a fact kind,
  add a threshold with it.
- **`data` exists so the consumer can re-phrase.** Plan 014 may hand the desk
  the sentence, the numbers, or both. Keep both populated.
- **New event kinds unlock new facts.** Two obvious ones once the draft ships:
  autodraft usage and mid-draft trades. Those need ledger writes first (see the
  draft plans), then a fact here.
- A reviewer should check the threshold gating specifically — that is the
  difference between a desk that sounds observant and one that sounds like a
  form letter.
