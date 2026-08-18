# Plan 018: The offer card — decide a trade with the facts in front of you

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 304cfb7..HEAD -- src/routes/league/\$leagueId/trades.tsx src/lib/league/ops.server.ts src/lib/league/fns.ts src/components/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/016 (`tradeDelta`), plans/017 (`PlayerStatRow`).
  Meaningful numbers also need plans/015.
- **Category**: direction
- **Planned at**: commit `304cfb7`, 2026-08-17

## Why this matters

Most managers receive more trades than they send, and receiving is the surface
with the least information in the app: a line of text per asset and two buttons.
Nothing says what the trade does to your roster, so the decision is made
elsewhere or not at all.

This plan replaces that with a card that answers the three questions a person
actually has — what do I get, what does it cost, and what does my lineup look
like afterwards — using data already loaded on the page.

## Current state

### What renders today

`src/routes/league/$leagueId/trades.tsx`, the "Book" section (~line 295-340):

```tsx
                <ul className="mt-2 space-y-1 text-sm">
                  {t.assets.map((a, i) => (
                    <li key={i} className="text-muted">
                      <span className="text-fg">{a.fromName}</span> → {a.toName}:{" "}
                      …
                <p className="mt-2 font-mono text-[11px] text-faint">
                  {t.sides.map((s) => `${s.teamName} ${s.accepted ? "in" : "…"}`).join(" · ")}
                </p>
```

Accept and Decline buttons follow. There is no Counter.

### The data available

`listTrades` (`src/lib/league/ops.server.ts`, ~line 690-760) returns per trade:

```ts
    out.push({
      id: t.id,
      week: t.week,
      status: t.status,
      proposerRoster: t.proposer_roster,
      created: /* epoch ms */,
      sides: sides.map((s) => ({
        rosterId: s.roster_id,
        teamName: names.get(s.roster_id) ?? `Team ${s.roster_id}`,
        accepted: s.accepted === 1,
        house: !owners.get(s.roster_id),
      })),
      assets: assets.map((a) => ({
        fromRoster: a.from_roster,
        /* … kind, playerId, pickNo, amount, and resolved names … */
```

Assets carry `kind: "player" | "pick" | "faab"`, so a FAAB leg already comes
back and just needs rendering.

Exposed to the client as `getTrades` in `src/lib/league/fns.ts`; the page
already calls it:

```tsx
  const trades = useQuery({
    queryKey: ["trades", leagueId],
    queryFn: () => getTrades({ data: { leagueId } }),
  });
```

### What plans 016 and 017 give you

- `tradeDelta({ players, rosterPositions, projections, outgoingIds, incoming })`
  from `src/lib/league/lineup-value.ts` → `{ before, after, change, changed[] }`,
  where `changed` lists only the slots whose occupant moved.
- `PlayerStatRow` from `src/components/player-stat-row.tsx`.

### The one gap

`tradeDelta` needs `RosterPlayer` objects for **incoming** players, and
`listTrades` returns ids and names. Resolve them from the counterparty's roster,
which `getTeam` already provides per roster id — see how
`src/routes/league/$leagueId/trades.tsx` already loads `themTeam` for the
composer.

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
- `src/components/trade-offer-card.tsx` (create)
- `src/routes/league/$leagueId/trades.tsx` — render the card in the Book section
  instead of the text list

**Out of scope** (do NOT touch):
- The propose form in the same file. Plan 019 rebuilds it; touching both at once
  makes the diff unreviewable.
- `voteTrade` / `cancelTrade` / `listTrades` — no server changes. This plan is a
  rendering change plus one derived number.
- `src/components/draft-trade-drawer.tsx` — in-draft trading, plan 011,
  separate work.
- Counter's *composer* behaviour. This plan adds the button and routes it; plan
  019 makes the composer accept a pre-filled deal.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: show what a trade offer does to your roster`

## Steps

### Step 1: The card

Create `src/components/trade-offer-card.tsx`:

```tsx
/**
 * An offer, with the facts needed to answer it.
 *
 * Deciding used to be two lines of text and two buttons, which is the least
 * information of any screen in the app despite being the most common trade
 * action. What you get comes first because that is what you opened it for;
 * what it costs is a column, not a footnote; and the position depth before and
 * after is the fact that actually decides it.
 */
export function TradeOfferCard({
  trade,          // one element of getTrades()
  myRosterId,
  delta,          // TradeDelta | null — null while rosters load
  onAccept, onDecline, onCounter,
  busy,
});
```

Structure:

1. **Header** — "{proposer} wants to trade", relative time from `trade.created`,
   and whether it is waiting on you (from `sides`).
2. **Two columns** — *You get* / *You give*, each a list of `PlayerStatRow`.
   Render pick and FAAB assets as their own compact chips; do not force them
   through the player row.
3. **Your roster after** — position counts now versus after, drawn as paired
   bars. Compute from the roster plus `delta`. Mark a position that drops to two
   or fewer with `bg-loss`.
4. **One sentence of consequence** — the change from `delta.change` and the most
   significant slot from `delta.changed`. Descriptive, never evaluative: "+2.1
   projected this week" and not "you win this trade". Plan 021 replaces this
   line with a fuller read; keep it simple here.
5. **Actions** — Decline (outline, `text-loss`), Counter (outline), Accept
   (push). Accept and Decline call the existing `voteTrade`.

Only the side waiting on you gets action buttons; a trade you proposed shows
its state instead.

**Verify**: `npm run typecheck` → exit 0.
`grep -c "#[0-9a-fA-F]\{6\}" src/components/trade-offer-card.tsx` → `0`.

### Step 2: Compute the delta on the page

In `trades.tsx`, for each pending trade involving you:

- outgoing ids = assets with `fromRoster === myRosterId` and `kind === "player"`
- incoming players = assets with `toRoster === myRosterId` and
  `kind === "player"`, resolved against the counterparty's `getTeam` payload
- call `tradeDelta(...)` with your roster, `roster_positions`, and the
  projections map

Reuse the existing `getProjections` query shape from
`src/routes/league/$leagueId/index.tsx` — do not invent a new one.

Pass `delta={null}` while the rosters are still loading and have the card show
the swap without the impact section, rather than rendering a zero. **A zero is a
claim; a blank is a wait.**

**Verify**: `npm run build` → exit 0. In `npm run dev` with a pending trade, the
card shows a non-zero change when the trade moves a starter, and "No change to
who starts" when it does not.

### Step 3: Counter

Wire Counter to navigate to the composer with the deal's assets in the URL —
for example `?counter=<tradeId>`. In this plan the composer may ignore the
param; plan 019 reads it.

Do not build a second composer inside the card.

**Verify**: pressing Counter changes the URL and does not throw. Record in your
report that the composer does not yet consume it.

### Step 4: Replace the text list

Swap the Book section's `<li>` markup for `TradeOfferCard`. Keep the section
heading and the empty state.

**Verify**: `git diff src/routes/league/\$leagueId/trades.tsx` touches only the
Book section and the imports — **no changes inside the propose form or
`AssetCol`**.

## Test plan

- No automated tests: `npm test` runs `node --test 'scripts/**/*.test.mjs'`
  (`package.json`) — build scripts only; there is no component harness.
- Manual, with a hosted league and at least one pending trade:
  1. A trade waiting on you shows Accept / Decline / Counter.
  2. A trade you proposed shows its waiting state and **no** Accept button.
  3. A trade that moves a starter shows a non-zero change; one that moves a
     bench player shows no lineup change.
  4. A trade containing a pick or FAAB renders those assets without crashing.
  5. Accept still works and the trade leaves the pending list.
  6. At 390px the two columns stack and the page does not scroll sideways.
- `npm test` stays green.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `src/components/trade-offer-card.tsx` exists and uses `PlayerStatRow`
- [ ] The impact section comes from `tradeDelta`, not a sum of the assets
      (`grep -n "tradeDelta" src/routes/league/\$leagueId/trades.tsx` matches)
- [ ] `delta === null` renders a blank impact section, never `0.0`
- [ ] Only the waiting side gets action buttons (manual 2)
- [ ] Pick and FAAB assets render (manual 4)
- [ ] The propose form and `AssetCol` are unmodified
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` 018 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `listTrades` no longer returns `assets` with `kind`, or drops the `amount`
  field that carries FAAB.
- `tradeDelta` or `PlayerStatRow` does not exist — plans 016 / 017 have not
  landed. Do not inline a copy of either.
- Resolving incoming players requires a `getTeam` call **per trade**. On a page
  with several pending trades that is a request storm; report it and consider
  loading each involved roster once and sharing the result.
- The impact bars disagree with the sentence — for example the sentence says
  "down to two backs" while the bars show three. Fix the source, do not adjust
  the copy to match a wrong chart.

## Maintenance notes

- **This is the highest-value half of the trade desk** and the cheapest to ship:
  no new state, no new mutation, a better rendering of data already fetched.
- **`delta === null` must stay distinguishable from a delta of zero.** They mean
  "we do not know yet" and "this changes nothing", and conflating them makes the
  card lie during load.
- **Plan 021 replaces the consequence sentence** with a fuller read line. Keep
  it a single computed string here so swapping it is a one-line change.
- **Counter's other half is plan 019.** Until then the param is inert — note
  that in the PR so a reviewer does not report it as broken.
- A reviewer should open a trade involving a pick or FAAB; those are the assets
  most likely to be forgotten in a player-shaped component.
