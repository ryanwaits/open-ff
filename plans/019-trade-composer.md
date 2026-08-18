# Plan 019: The composer — build a deal you can read, and send FAAB with it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 304cfb7..HEAD -- src/routes/league/\$leagueId/trades.tsx src/lib/league/fns.ts src/lib/league/ops.server.ts src/components/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/016 (`tradeDelta`), plans/017 (`PlayerStatRow`),
  plans/018 (Counter sets the URL param this plan reads)
- **Category**: direction
- **Planned at**: commit `304cfb7`, 2026-08-17

## Why this matters

Two things are wrong with composing a trade today. The deal you are assembling
is never shown as one object — selections stay highlighted inside two long
scrolling lists, so reading back what you are about to send means re-scanning
both columns. And **FAAB cannot be traded at all from the UI**, even though the
engine has accepted it since the book shipped.

The fix is a three-column layout with the deal in the middle: rosters flank it,
the deal is a real panel with a live balance, and FAAB is an input rather than
an omission.

## Current state

### The form

`src/routes/league/$leagueId/trades.tsx` (443 lines). State (~line 28-60):

```tsx
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [thirdId, setThirdId] = useState<number | null>(null);
  const [minePlayers, setMinePlayers] = useState<string[]>([]);
  const [themPlayers, setThemPlayers] = useState<string[]>([]);
  const [thirdPlayers, setThirdPlayers] = useState<string[]>([]);
  const [minePicks, setMinePicks] = useState<number[]>([]);
  const [themPicks, setThemPicks] = useState<number[]>([]);
  const [thirdPicks, setThirdPicks] = useState<number[]>([]);
  const [mineTo, setMineTo] = useState<number | null>(null);
  const [themTo, setThemTo] = useState<number | null>(null);
  const [thirdTo, setThirdTo] = useState<number | null>(null);
```

**Three teams and per-asset destinations already work.** This plan is a
redesign, not new capability — plan 020 handles the three-team presentation;
here, preserve the two-team path and do not regress the third.

Rendering is `AssetCol` (~line 359-430): a destination chip row plus a scrolling
list of toggle buttons, twice, in a `lg:grid-cols-2`.

### The submit path

`proposeTrade` in `src/lib/league/ops.server.ts` takes:

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

FAAB is validated against **unstaked** balance — money on the book is not
tradeable. The page never sends a `faab` asset.

Exposed through `src/lib/league/fns.ts`; the validator already accepts
`kind: z.enum(["player", "pick", "faab"])` and `amount`.

### What you are given

- `tradeDelta(...)` from `src/lib/league/lineup-value.ts` (plan 016)
- `PlayerStatRow` from `src/components/player-stat-row.tsx` (plan 017)
- Rosters via `getTeam`, picks via `getTradablePicks` — both already queried in
  this file

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
- `src/components/trade-composer.tsx` (create) — the three-column composer
- `src/routes/league/$leagueId/trades.tsx` — render it in place of the propose
  form; delete `AssetCol` once nothing references it

**Out of scope** (do NOT touch):
- `proposeTrade` and its validation. It already accepts everything this sends.
- The Book section — plan 018 owns it.
- `src/components/draft-trade-drawer.tsx` — in-draft trading, plan 011,
  separate work.
- Three-team **presentation** — plan 020. Keep the existing third-team code
  path working; do not redesign it here and do not delete its state.
- Drag and drop. Click to add, × to remove. No new dependency.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: compose a trade you can actually read`

## Steps

### Step 1: The component shell

Create `src/components/trade-composer.tsx`:

```tsx
/**
 * Three columns, and the deal is the middle one.
 *
 * The old form kept selections highlighted inside two scrolling lists, so the
 * thing you were about to send never existed anywhere as one object. Here it
 * does, with a running balance — and FAAB is an input rather than something the
 * engine accepts but the page cannot offer.
 */
export function TradeComposer({
  leagueId, myRosterId, partners,
  myRoster, theirRoster, myPicks, theirPicks,
  projections, rosterPositions,
  myFaabFree, theirFaabFree,
  initial,        // pre-fill from a Counter (plan 018)
  onProposed,
});
```

Left and right are roster panels of `PlayerStatRow`; the middle is the deal.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: The deal panel

The middle column shows, in order:

1. **You send** — chips for chosen assets, each with a × to remove.
2. **plus FAAB** — a digits-only text input, capped at your **unstaked**
   balance. Copy the input treatment from `src/components/wager-ticket.tsx`,
   which already solves this: `inputMode="numeric"`, strip non-digits, show the
   remaining balance beside it.
3. **You get** — same, for the other side.
4. **Balance** — from `tradeDelta`: starters now, starters after, the change,
   plus roster spots and FAAB.
5. **Propose**, disabled until at least one asset or a non-zero FAAB amount
   exists.

The balance must be the **lineup delta**, not a sum of the assets. That
distinction is the entire point of plan 016: trading a QB1 while holding a QB2
costs the gap, not the score.

Show only the slots that changed. An unchanged lineup row is noise, and the
point is to show *who backfills*.

**Verify**: in `npm run dev`, adding a bench player to the deal shows "No change
to who starts", and adding a starter shows a named slot swap with a delta.

### Step 3: Send FAAB

On submit, build the asset list. A non-zero FAAB box becomes:

```ts
{ fromRoster: myRosterId, toRoster: them, kind: "faab", amount: myFaab }
```

Cap the input at the unstaked balance client-side; the server enforces it again
via `spendable()`, so a mismatch is refused rather than mis-applied.

**Verify**: propose a FAAB-only trade between two rosters and accept it. Both
balances change and the league total is unchanged:

```
npx vite-node -e "
  const { getSql } = await import('./src/lib/db.ts');
  const sql = await getSql();
  console.log(await sql\`select roster_id, faab_remaining from ff_rosters where league_id = '<id>' order by roster_id\`);
"
```

Record before and after in your report.

### Step 4: Accept a counter

Read the `?counter=<tradeId>` param plan 018 sets. When present, pre-fill the
composer from that trade's assets **with the sides swapped from your point of
view**, and show a line saying it is a counter to an existing offer.

Do not auto-decline the original. Countering is a new proposal; whether the old
one is withdrawn is the proposer's business.

**Verify**: press Counter on an offer (plan 018), land on the composer, and see
the assets pre-filled.

### Step 5: Replace the form and remove the dead code

Swap the propose section for `<TradeComposer …>`. Then:

```
grep -n "AssetCol" src/routes/league/\$leagueId/trades.tsx
```

If nothing references it, delete the function. If the third-team path still
uses it, **leave it** — plan 020 removes it.

**Verify**: `npm run build` → exit 0, and the two-team propose flow works end to
end: pick players both ways, propose, and the trade appears in the Book.

## Test plan

- No automated tests: `npm test` runs `node --test 'scripts/**/*.test.mjs'`
  (`package.json`) — build scripts only.
- Manual, with a hosted league:
  1. Two-team player-for-player trade proposes and appears in the Book.
  2. A pick in the deal survives the round trip.
  3. FAAB-only trade moves money; the league total is unchanged (step 3).
  4. Typing a FAAB amount above your unstaked balance is refused, with the
     reason visible.
  5. The balance shows a lineup delta — trading a bench player reads as no
     change.
  6. Countering pre-fills.
  7. The existing three-team path still proposes successfully, even if it looks
     unchanged.
  8. At 390px the three columns stack and nothing scrolls sideways.
- `npm test` stays green.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `src/components/trade-composer.tsx` exists and uses `PlayerStatRow`
- [ ] The balance calls `tradeDelta`, not a sum of assets
- [ ] A `faab` asset can be proposed and lands (manual 3)
- [ ] FAAB is capped at the unstaked balance, client and server
- [ ] The three-team path still proposes (manual 7)
- [ ] `proposeTrade` and its validator are unmodified
- [ ] No new npm dependency (`git diff package.json` is empty)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 019 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `TradeAssetIn` no longer has the `faab` kind, or `proposeTrade` no longer
  validates it against `spendable()`.
- Removing `AssetCol` breaks the third-team path. Leave it in place and note it
  for plan 020 rather than redesigning three-team here.
- A FAAB trade moves money but the league total changes. Stop — that is a
  conservation bug in the engine, not a UI bug, and it matters more than this
  plan.
- The composer needs a `getTeam` call on every keystroke or filter change.
  Rosters should be fetched once per partner and filtered client-side.

## Maintenance notes

- **Three-team state is deliberately untouched here.** `thirdId`, `thirdTo` and
  friends still exist and still work; plan 020 gives them a presentation. Do not
  delete them as "unused" — they are reachable.
- **FAAB has two ceilings and they must agree.** The client caps at the unstaked
  balance for a good error, and `spendable()` enforces it server-side. If the
  book ever changes how staking works, both move together.
- **The balance is the reason this plan exists.** If a reviewer sees a sum of
  projections rather than a lineup delta, that is the thing to send back.
- A reviewer should try a bench-player trade: the correct answer is "no change
  to who starts", and getting a non-zero number there means `tradeDelta` is
  being misused.
