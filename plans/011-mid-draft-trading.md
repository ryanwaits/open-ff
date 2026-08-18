# Plan 011: Mid-draft trading — picks, drafted players and FAAB, from inside the draft

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9948a37..HEAD -- src/lib/league/ops.server.ts src/lib/league/fns.ts src/routes/league/\$leagueId/draft.tsx src/routes/league/\$leagueId/trades.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/007 (the board is where a traded pick becomes visible).
  Independent of 008–010 — can run in parallel with them.
- **Category**: direction
- **Planned at**: commit `9948a37`, 2026-08-17

## Why this matters

Trading during a draft is the thing that makes a draft memorable, and **the
backend already supports all three asset types**. There is simply no button.
This plan is mostly UI plus one new guard.

## Current state

### All three asset types already validate

`proposeTrade` in `src/lib/league/ops.server.ts (proposeTrade)` takes:

```ts
export type TradeAssetIn = {
  fromRoster: number;
  toRoster: number;
  kind: "player" | "pick" | "faab";
  playerId?: string | null;
  pickNo?: number | null;
  /** Dollars, for a `faab` asset. */
  amount?: number | null;
};
```

- **Picks** — validated as existing, unused, and owned by `fromRoster`
  (`ops.server.ts` inside the asset loop):
  ```ts
      const pick = await sql<{ roster_id: number; player_id: string | null }>`
        select roster_id, player_id from ff_picks where league_id = ${leagueId} and pick_no = ${a.pickNo}
      `;
      if (!pick[0]) throw new Error("That pick does not exist. Open the draft board first.");
      if (pick[0].player_id) throw new Error("That pick is already used.");
      if (pick[0].roster_id !== a.fromRoster) throw new Error("They don't own that pick.");
  ```
- **Players** — validated against `ff_spots`. This works mid-draft because
  `claimPick` inserts into `ff_spots` the moment a pick lands
  (`engine.server.ts:961-964`):
  ```ts
  	await sql`
      insert into ff_spots (league_id, roster_id, player_id, slot, starter_slot)
      values (${leagueId}, ${pick.roster_id}, ${playerId}, ${"bench"}, ${null})
    `;
  ```
- **FAAB** — validated against unstaked balance via `spendable()`.

### The deadline already exempts the draft

`proposeTrade` skips the trade-deadline check while drafting
(`ops.server.ts (proposeTrade, deadline check)`):

```ts
  if (
    league.current_week > (league.trade_deadline_week ?? 11) &&
    league.status !== "pre_draft" &&
    league.status !== "drafting"
  ) {
    throw new Error("Trade deadline has passed.");
  }
```

### Execution already moves everything

`ff_picks.roster_id` is updated for a traded pick and `original_roster` records
the seat it came from — which `loadDraft` already surfaces as `via`
(`engine.server.ts:911-922`), and plan 007 renders on the board.

### The gap

1. `src/routes/league/$leagueId/draft.tsx` has no trade entry point at all.
2. **No guard stops trading the pick that is on the clock.** That is the one new
   rule this plan adds.

### Why the on-clock pick must be refused

If a trade can move the pick currently up, then either the new owner inherits a
half-spent clock — punishing them for accepting — or they get a fresh one, which
makes *trade the pick you are on* an unlimited stall button. Pausing the draft
for every offer is worse: ten managers negotiate indefinitely and the draft never
finishes.

Refusing the one live pick costs nothing. Every future pick, every drafted
player and any FAAB stays tradeable, the clock never stops, and the board only
ever changes *ahead* of the current pick — so nothing already resolved can be
rewritten.

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
- `src/lib/league/ops.server.ts` — the on-clock guard in `proposeTrade`, and the
  same guard in the accept path
- `src/components/draft-trade-drawer.tsx` (create)
- `src/routes/league/$leagueId/draft.tsx` — the entry point and the drawer

**Out of scope** (do NOT touch):
- The three asset validations above — they already work. Do not "improve" them.
- `src/routes/league/$leagueId/trades.tsx` — the season-long trade desk stays as
  it is. This plan adds a draft-specific surface, not a replacement.
- `voteTrade` / `cancelTrade` beyond adding the guard — acceptance flow is
  unchanged otherwise.
- Future-season picks. Locked decision: **this year's board only**. `ff_picks`
  has no season column and adding one is a much larger change.
- The clock (008), autodraft (009), the queue (010).

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: trade from inside the draft room`

## Steps

### Step 1: Refuse the pick on the clock

In `src/lib/league/ops.server.ts`, inside `proposeTrade`'s asset loop, in the
`a.kind === "pick"` branch, after the existing ownership checks:

```ts
      // The live pick cannot move. Otherwise the new owner either inherits a
      // half-spent clock or gets a fresh one — and a fresh one turns "trade the
      // pick you are on" into an unlimited stall button.
      const draft = (await sql`
        select pick_no, status from ff_draft where league_id = ${leagueId}
      `)[0];
      if (draft?.status === "live" && draft.pick_no === a.pickNo) {
        throw new Error("That pick is on the clock and cannot be traded.");
      }
```

Add the **same** check where a trade is executed. Find the function that applies
accepted trades (it moves `ff_spots` rows and updates `ff_picks.roster_id`) and
guard each pick asset there too. A trade proposed legally can be accepted after
the board has advanced onto that very pick — first-write-wins is not enough here
because the two writes touch different rows.

**Verify**: `grep -c "on the clock and cannot be traded" src/lib/league/ops.server.ts`
→ `2` (propose and accept). `npm run typecheck` → exit 0.

### Step 2: The drawer component

Create `src/components/draft-trade-drawer.tsx` exporting `DraftTradeDrawer`.

Use `@radix-ui/react-dialog` — already a dependency, and the pattern to copy is
`src/components/claim-dialog.tsx` (overlay + content + `Dialog.Title` +
`Dialog.Description`). Read it before writing.

Contents:

- **Counterparty picker** — the other seats in the league.
- **You send / You get**, each listing chosen assets with a × to remove, and
  three add buttons: **+ Pick**, **+ Player**, **+ FAAB**.
  - *Pick*: that roster's unused picks. Exclude the on-clock pick from the list
    entirely rather than letting it be picked and rejected — a disabled row with
    "on the clock" reads better than an error after the fact.
  - *Player*: that roster's drafted players (from `ff_spots` via the team data
    the page already loads, or a small addition to `loadDraft` if it is not
    there — prefer reusing what exists).
  - *FAAB*: a number input, matching the stepper in `claim-dialog.tsx`.
- **Submit** calls the existing `proposeTrade` server fn in
  `src/lib/league/fns.ts` and invalidates `["draft", leagueId]` and
  `["trades", leagueId]`.
- Errors from the server render **in place** in the drawer, not as a toast —
  same as `claim-dialog.tsx`'s failure banner.

Tokens only; no hex values.

**Verify**: `npm run typecheck` → exit 0.
`grep -rn "#[0-9a-fA-F]\{6\}" src/components/draft-trade-drawer.tsx` → no
matches.

### Step 3: Entry point on the draft page

In `draft.tsx`, add a **Propose a trade** button next to the on-clock line, and
render the drawer. It should be available whenever the viewer has a seat and the
league is not locked — including while it is *not* their turn, since most
draft-night trades happen while waiting.

**Verify**: `npm run build` → exit 0. In `npm run dev`, the button opens the
drawer and closing it does not disturb the poll.

### Step 4: Confirm a trade lands on the board

With two seats in a hosted league, propose and accept a pick trade, then look at
the board from plan 007.

**Verify**: the traded pick's cell now sits in the new owner's column and shows
the `←SEAT` marker. If plan 007 has not landed, verify instead that
`loadDraft().stock` shows the pick under the new `rosterId` with a non-null
`via`.

## Test plan

- No new automated tests. `npm test` runs `node --test 'scripts/**/*.test.mjs'`
  (`package.json`) — build scripts only; no engine or DB harness exists and this
  plan does not add one.
- Manual, with a hosted league mid-draft in `npm run dev`:
  1. Trade a future pick for a future pick. Both boards update.
  2. Trade a player drafted thirty seconds ago. He moves rosters.
  3. Include FAAB. Both balances change and the total across the league is
     unchanged.
  4. **Try to trade the pick currently on the clock.** It is not offered in the
     picker, and if forced through the server fn it is refused with
     "That pick is on the clock and cannot be traded."
  5. Propose a trade for pick N, let the board advance onto pick N, then accept.
     It is refused rather than corrupting the board. **This is the step most
     likely to be missed — do not skip it.**
- `npm test` stays green.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] The on-clock guard exists in **both** the propose and accept paths
- [ ] `src/components/draft-trade-drawer.tsx` exists and uses
      `@radix-ui/react-dialog`
- [ ] Manual tests 4 and 5 both refuse
- [ ] No change to the `player` / `faab` asset validations (`git diff` on
      `ops.server.ts` shows only the guard additions)
- [ ] No new npm dependency (`git diff package.json` is empty)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 011 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `TradeAssetIn` does not have a `faab` kind, or `proposeTrade` does not exempt
  `drafting` from the deadline check. Both are in the excerpts above; if they
  are gone the codebase has drifted and this plan's premise is wrong.
- You cannot find the trade **execution** function to add the second guard to.
  Do not ship with only the propose-side guard — that is the exact hole manual
  test 5 exists to catch.
- Adding the guard requires changing how `ff_picks.roster_id` is updated. It
  should not; if it does, report what you found.
- The drawer needs a roster's drafted players and you cannot get them without a
  new query per keystroke. Report it rather than adding an N+1 to a page that
  polls every 4 seconds.

## Maintenance notes

- **`original_roster` is what makes a traded pick legible** on the board and in
  the desk write-ups later. Never overwrite it when a pick changes hands — only
  `roster_id` moves.
- **The on-clock guard is duplicated on purpose** (propose + accept). If a third
  path to move a pick is ever added, it needs the guard too. Consider extracting
  it to one helper at that point, not before.
- A reviewer should specifically test the accept-after-advance case; it is the
  only way the board can be corrupted by this feature.
- Deferred: trading future-season picks (locked out), and a trade *review*
  surface inside the draft. The existing trade desk covers acceptance.
