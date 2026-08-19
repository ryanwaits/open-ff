# Implementation Plans

Slices live here. Read the one you are executing from.

- **001–005 — Desk performance** (improve skill, 2026-08-17, commit `1abb347`).
  Goal: league desk feels like a spreadsheet — last-known numbers stay painted,
  tabs do not reload, hard refresh restores the workbook, live scores still tick.
  **All five are DONE.**
- **006–014 — Draft room and league memory** (improve skill, 2026-08-17, commit
  `9948a37`). Goal: a draft worth sitting in — a board, a 90-second clock,
  sticky autodraft, a queue, mid-draft trading of picks/players/FAAB, and a mock
  mode — then the second half of the context engine, so the weekly desk write-up
  remembers a season instead of a week.
- **015–021 — Projections and the trade desk** (improve skill, 2026-08-17,
  commit `304cfb7`). Goal: a projection that moves during the season, a trade
  priced by what your lineup actually scores, and a desk built from player rows
  that carry their numbers instead of names that carry nothing.
- **022–026 — Agent-native foundation** (improve skill, 2026-08-17, commit
  `553f159`). Goal: the league is something a commish can run, a friend can
  put on a home screen, a harness can restyle, and an agent can *use* —
  because the primitives are named and tested, not because we added a chat
  widget. 024–026 are DONE.
- **027–029 — Purse, door, and a real click** (improve skill, 2026-08-18,
  commit `b918703`). Goal: the book cannot invent FAAB, a league can be
  locked to invited emails and member-only reads, and the wager ticket is
  scripted so we stop saying "no one has clicked it." **All three are DONE**
  (verified `dd9bc53`).
- **030–037 — Close the door, then self-host leftovers** (improve skill,
  2026-08-19, commit `dd9bc53`). Goal: invite-only means the RPCs too;
  the remaining skips and self-host gaps are named instead of rediscovered.
- **038–040 — Agent can actually use the catalog** (improve skill,
  2026-08-19, commit `dd9bc53`). Goal: one context dump, pull-ticket
  parity, and no minted FAAB on trade accept — so a loop over named
  verbs is honest. 033 (mutating CLI) runs **after** 038, not before.
- **041–044 — Headless engine: token, MCP, skills** (improve skill,
  2026-08-19, commit `735b0ba`). Goal: Codex / Claude / Grok can
  install open-ff as a tool server (stdio local, HTTP hosted) and
  run migrate / sit / book playbooks. The PWA stays client zero.
- **045 — Migrate sources** (improve skill, 2026-08-19, commit
  `735b0ba`). After 044. Canonical import pack; file always works;
  NFL hops to ESPN; Yahoo OAuth gated on actual API approval.

Execute in the order below. Each executor: read the plan fully, honor STOP
conditions, update your row when done.

## Decisions locked in

### Desk performance (001–005)

- **Hard refresh = persist first**, not SSR dehydrate. `myRosterId` is auth-personalized; a public HTML cache would lie. Persist the workbook keys in localStorage; keep live scores memory-only. Dehydrate is a later pass if first *anonymous* visit matters.
- **Do not keep sheets mounted with `<Activity>` in this slice.** After 001, a remount reads the React Query cache and should paint instantly. Persist matchup `focus` in the URL (already on `/matchups`). Revisit Activity only if replay/scroll position still feels like a remount after 001–003 — and only if hidden trees pause their `refetchInterval`.

### Draft room (006–012)

- **90 seconds a pick.**
- **A missed clock turns autodraft on and leaves it on** until the manager turns
  it off — not a one-off autopick. Someone away for one pick is usually away for
  the next, and a 90-second stall every round is worse for the nine people who
  are present than an autopick is for the one who is not. Consequence: the queue
  stops being a convenience and becomes the thing that drafts your team, which
  is why 010 is a companion to 009 rather than optional.
- **Expiry is checked on read, not only on cron.** There is no socket layer and
  `/api/league/tick` is hourly, so a deadline nobody acts on would let a board
  sit dead for up to 59 minutes. `loadDraft` advances a stalled board, so
  whoever is looking keeps it moving. Every advance is a **conditional write** so
  two clients cannot double-advance. This is the single most important decision
  in the slice — see 008.
- **The pick on the clock cannot be traded.** Otherwise the new owner either
  inherits a half-spent clock or gets a fresh one, and a fresh one turns "trade
  the pick you are on" into an unlimited stall button. Every future pick, every
  drafted player and any FAAB stays tradeable.
- **No future-season picks.** This year's board only.
- **The mock uses the league's scoring book**, has no clock, and its history is
  **ephemeral** — in memory while the page is open, gone on reload.

### League memory (013–014)

- **The ledger was written before anything read it** and is already
  accumulating. 013 is the rollup half; 014 is the consumer.
- **Facts are threshold-gated.** A fact that fires in week 1 is noise, and noise
  is what makes generated writing feel generated. An empty fact list is a correct
  answer.
- **At most two facts per desk edition.** The cap is the feature; raising it
  turns the desk into a trivia column.

### Projections and the trade desk (015–021)

- **Projections come from Sleeper's weekly feed, scored under each league's own
  book.** Verified live: `/projections/nfl/{season}/{week}` answers 200 and
  returns 26 QB / 78 RB / 124 WR / 73 TE with real numbers for week 8 of 2025.
  Crucially it returns **raw components** (`pass_yd`, `rush_yd`, `rec`, …), not
  just `pts_ppr` — so it goes through `applyBook()` exactly like an actual week
  and a half-PPR league sees a half-PPR number. Storing or showing `pts_ppr`
  directly is the bug this avoids.
- **`perGameUnder` stays as the fallback**, and a projection sourced from it is
  labelled `season-avg` rather than passed off as a forecast.
- **A trade is priced by replacement value, never by summing the assets.** Fill
  the starting lineup best-first before and after, and diff the totals. Trading
  a QB1 while holding a QB2 costs the gap, not the score; trading a bench player
  costs nothing. This is the single most important idea in the slice.
- **No trade grades.** The app states what changes (`+2.1 projected`) and never
  whether it is a good deal — the projection cannot support that claim. Plan 021
  enforces it with a test that fails on evaluative words.
- **The read line is deterministic, not a model call.** One short sentence over
  numeric inputs; a model would add latency and a chance of inventing a figure.
  The richer, model-written voice lives in the desk (013/014), where facts are
  already threshold-gated.
- **Rest-of-season projections are deferred.** A weekly number is not a season
  value, and blending them silently would be dishonest. Its own plan when wanted.

### Agent-native foundation (022–026)

- **The engine is already the product.** ~50 server fns, a scoring book, FAAB,
  trades, a house book, an event diary. 024 names those verbs in
  `src/lib/agent/` + `scripts/ledger.mjs` (reads only).
- **Features are still code, used via prompts.** "Add betting by describing
  it" already happened as a human vertical slice (`wagers.server.ts`). The
  next market is a registry (not in this slice) sitting on a conserved FAAB
  purse. 022 pins the purse *before* 024 lets an agent stake it.
- **Do not wrap `tickAllLeagues` as a tool.** 023 secrets the URL; 024 omits
  it from the catalog.
- **Skin is an overlay, not a fork.** 026 extracts `src/skin/*`. Do not
  unbrand `public/__grok/install` or delete `grokPwaPlugin`.
- **One installed PWA named open-ff**, `start_url=/`. Not a per-league icon.
- **Events stay a diary.** Mechanics stay on tables. 024 exposes `readEvents`
  / facts as reads.
- **Product name is open-ff.** License is MIT. (025 / 026)
- **Join stays invite-code.** Allowlist + member reads landed in **028**.
- **Mutating wager CLI is still off.** 027 closed the mint; 033 wires
  `placeWager` behind `--write` **after** 038 (context dump). Do not
  ship a write CLI that cannot see spendable.
- **Postgres stays the source of truth.** Files-as-interface from the
  Every guide is the wrong storage bet for a multi-manager money
  system. Agents get a legible catalog + a live context dump
  (`getAgentContext`), not a notes-folder rewrite.
- **Operator CLI ≠ manager session.** `ledger.mjs` / MCP stdio +
  `DATABASE_URL` + `OPENFF_USER` is the commish-on-the-box path.
  A hosted friend uses a personal `off_` token (041), never a
  client-supplied `userId`. No shared league API key.
- **MCP is the plug, skills are the features, plugins are a box.**
  Build one server (`dispatch` + `AGENT_CORE`) and three markdown
  skills. Do not build a Codex app, a Claude app, and a Grok app.
  A `/plugin` marketplace listing is packaging for later.
- **Conservation is a guardrail, not a workflow tool.** `applyLoss` /
  `spendable` / execute-trade refusal stay in code. Judgment about
  *whether* to stake belongs in the prompt.
- **Engine stays UI-blind.** No `renderMatchupHtml` in the catalog.
  Generative UI / voice / Codex artifacts are clients.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001  | League tabs are in-app Links; router preloads on intent | P1 | S | — | DONE `e79cfbc` (not pushed) |
| 002  | Never unmount last-known data; never lie about empty | P1 | S | — | DONE `ae6e12d` (not pushed) |
| 003  | Shared QueryClient + loaders warm the next sheet | P1 | M | 001 | DONE `2f203be` (not pushed) |
| 004  | Persist the workbook across refresh | P1 | M | 003 | DONE `9948a37` (not pushed) |
| 005  | Cheap GETs: no tick-on-read, no extra bundle | P2 | M | — | DONE `deab224` (not pushed; step 4 slim week-stats skipped) |
| 006  | Draft schema — clock deadline, sticky autodraft, pick queue | P1 | S | — | DONE `32fc696` (not pushed) |
| 007  | Draft board grid — every pick visible at once | P1 | M | — | DONE `304cfb7` (not pushed) |
| 008  | Draft clock — 90s a pick, advanced by whoever is looking | P1 | M | 006 | DONE `6ef392e` (not pushed; live expiry race not exercised — no unlocked draft) |
| 009  | Sticky autodraft after a missed pick | P1 | S | 006, 008 | DONE `7cfd24c` (not pushed; live toggle tests skipped) |
| 010  | Draft queue — the list that drafts for you | P1 | M | 006, 009 | DONE `ee66f0a` (not pushed) |
| 011  | Mid-draft trading — picks, drafted players, FAAB | P2 | M | 007 | DONE `cf6fa91` (not pushed; live trade tests skipped — no signed-in mid-draft league) |
| 012  | Mock draft — the same room with the writes turned off | P3 | M | 007, 010 | DONE `81b0c4c` (not pushed) |
| 013  | Derived league facts — roll the ledger into standing facts | P2 | M | — | DONE `5009378` (not pushed; `832ba4e` locked-only, `ce31848` format) |
| 014  | The desk remembers — feed facts into the weekly write-up | P2 | S | 013 | DONE `7af3716` (verified `e6d44de`: desk calls `loadLeagueFacts`) |
| 015  | Live weekly projections — a number that moves | P1 | M | — | DONE `d6d855d` (not pushed) |
| 016  | Replacement value — price a trade by the lineup it produces | P1 | S | — | DONE `7af4bf4` (verified `e6d44de`: `lineup-value.ts`) |
| 017  | The player stat row — avatar, projection, rank, shape | P1 | M | — | DONE `553f159` (not pushed) |
| 018  | The offer card — decide with the facts in front of you | P1 | M | 016, 017 | DONE `5b092fa` (not pushed) |
| 019  | The composer — a readable deal, and FAAB you can send | P2 | L | 016, 017, 018 | DONE `ec855c3` (verified: composer sends `kind: "faab"`) |
| 020  | Three-team trades — every asset says where it lands | P3 | M | 019 | DONE `4356a5e` (not pushed) |
| 021  | The read line — one sentence that arranges the numbers | P3 | S | 016, 018/019 | DONE `7e6cac7` (verified: `trade-read.ts`) |
| 022  | Prove FAAB, settlement, and clock with tests | P1 | M | — | DONE `ec0bd72` (live spendable/atRisk still skipped; mint case flipped in 027) |
| 023  | Close the public clock, invite leak, and bid leak | P1 | S | — | DONE `d9083ad` (verified: `CRON_SECRET` + commish-only invite) |
| 024  | Publish the primitive catalog and a thin tool surface | P1 | M | 022, 023 | DONE `7f5a247` (verified `b918703`: catalog + `getEvents` / `getLeagueFacts` + `scripts/ledger.mjs`) |
| 025  | Make a stranger able to run a league | P1 | M | 023 | DONE `f738a3b` (verified: `open-ff`, README, LICENSE, PGLite `dataDir`) |
| 026  | Skin contract + scan-to-homescreen | P2 | M | 025 | DONE `b918703` (verified: `src/skin/*`, join keeps `?code=`) |
| 027  | Stop a lost wager from minting FAAB | P1 | M | 022 | DONE `9f512b5` (verified `dd9bc53`: `applyLoss` + `movePool(poolCredit)`) |
| 028  | Invite-only desk — allowlist emails and member reads | P1 | M | 023 | DONE `fe3d1a6` (verified `dd9bc53`: allowlist + viewer on listed wrappers) |
| 029  | Exercise the FAAB wager ticket for real | P2 | M | — | DONE `dd9bc53` (verified: `wager-qa.mjs` + testids; preseason no-price) |
| 030  | Require a seat for every hosted league GET | P1 | S | 028 | DONE `4fd580c` (not pushed; eight hosted GETs + source test) |
| 031  | Prove spendable and atRisk without a live database | P2 | S | 027 | TODO |
| 032  | Re-run the wager script when a week has a live line | P3 | S | 029 | TODO (ops; no code) |
| 033  | Let the CLI place a wager when asked in writing | P2 | M | 027, 038 | TODO (after 038) |
| 034  | Let a commish download their league | P2 | M | 025 | TODO |
| 035  | Optional native Google sign-in for self-host | P2 | M | 025 | TODO |
| 036  | Let a commish delete a league they run | P2 | M | 034 | TODO |
| 037  | Web Push after someone actually installs the PWA | P3 | L | 026 | TODO (stop if no install) |
| 038  | One dump: seat, spendable, facts, verbs | P1 | M | 024 | TODO |
| 039  | Pull an open ticket from the book list | P1 | S | 024 | TODO |
| 040  | Refuse a FAAB trade the sender cannot cover | P1 | S | 027 | TODO |
| 041  | Mint a personal token so a host can act as a seat | P1 | M | 038 | TODO |
| 042  | Speak MCP on stdio (local Codex / Claude / Grok) | P1 | M | 038, 033 | TODO |
| 043  | Serve the same MCP over HTTP with the token | P1 | M | 041, 042 | TODO |
| 044  | Skills: migrate, lineup, book | P1 | S | 042 | TODO |
| 045  | Canonical import pack; file fallback; no NFL scrape | P1 | L | 044 | TODO (after 044; Yahoo gated) |

Status values: TODO | IN PROGRESS | DONE | BLOCKED | REJECTED

## Dependency notes

### 001–005

- 001 and 002 can run in parallel. Prefer 001 first — it is the largest perceived win and unblocks hover-preload.
- 003 depends on 001 (`defaultPreload` only helps if tabs are `<Link>`). It also introduces `src/lib/query-client.ts`, which 004 extends.
- 004 depends on 003 so persist attaches to the *router* QueryClient, not a second client created in `__root.tsx`.
- 005 is independent of the client plans. Can ship anytime; cheapest after 003 so loaders are not amplifying expensive GETs.

### 006–014

- **006 blocks 008, 009 and 010** — they read columns it adds. It is 30 minutes
  and changes nothing user-visible, so do it first regardless of what else is
  planned.
- **007 is independent of 006.** It reads no new columns and adds no writes,
  which makes it the safest thing to ship first if you want visible progress.
- **008 → 009 → 010 is a hard chain.** 009 modifies the `stampDeadline` and
  `expireDraftPicks` that 008 creates; 010 modifies the `autopickFor` that 008
  extracts.
- **011 is parallelisable** with 008–010. It only needs 007 for the board to
  render a traded pick, and touches `ops.server.ts` rather than the draft engine.
- **012 needs 007 and 010** because it reuses `DraftBoard` and the queue panel
  unchanged. If it cannot reuse them, that is a signal 007 built the board too
  specifically — treat it as a STOP, not a fork.
- **013 and 014 are independent of the whole draft slice.** They can run at any
  time by a second executor. 014 needs 013.

### 015–021

- **015 is independent and highest leverage.** Six surfaces read through
  `projectPlayers` / `outlooksFor` — the lineup board, the matchup spread, win
  probability, the waiver dialog, and the whole trade desk — so it upgrades all
  of them at once. Everything in 016–021 is *correct* without it but works off a
  flat season average until it lands.
- **016 and 017 are independent of each other** and both independent of 015.
  Two executors can take one each.
- **018 needs 016 and 017.** It is the highest-value trade surface and the
  cheapest: no new state, no new mutation, a better rendering of data the page
  already fetches.
- **019 needs 018** only for the `?counter=` param it consumes; the rest is
  independent. It is the largest plan in the slice.
- **020 extends 019** and finishes removing `AssetCol`. 019 is explicitly told
  to leave the existing three-team code path working rather than redesign it.
- **021 needs 016** plus whichever of 018/019 exists.
- **Relationship to 011 (in-draft trading):** separate work, no dependency in
  either direction. 011 built `src/components/draft-trade-drawer.tsx` for
  trading *during a draft*; 015–021 rebuild the season-long trade desk. Both
  could share `PlayerStatRow` from 017 as a follow-up — worth doing so the two
  trade surfaces look alike, but neither blocks the other and 017 is told not to
  touch the drawer.

## Known repo hazards (read before executing 006–014)

- **`src/lib/league/engine.server.ts` is `// @ts-nocheck`.** `npm run typecheck`
  will not check anything inside it, though exported signatures still bind
  consumers. The trap: add a field to a declared return type, forget it in the
  returned object, and typecheck passes while the field is `undefined` at
  runtime. Plans 007–010 each restate this; verify engine return fields in the
  browser Network tab, not with typecheck.
- **`npm test` runs `node --test 'scripts/**/*.test.mjs'`** — build scripts
  only. There is no engine, DB or component test harness, and none of these
  plans stands one up. Verification is typecheck + build + a scripted
  `npx vite-node` call + manual steps.
- **`biome.json` now exists** and pins `indentStyle: "space"`. The old
  "do not `--write`" hazard is gone. `bun run lint` is the gate.
- **`bun test` is `bun test src scripts`.** Includes scoring, odds, win%,
  mock-draft, `applyLoss`, allowlist match, catalog ids, wager testids.
  Live `spendable` / `atRisk` still skipped (PGLite cannot migrate under
  bun — no `import.meta.glob`).
- **`npm test` / vite-node notes above are stale for 022+.** Use `bun`.

## Findings considered and rejected

- **React `<Activity>` keep-alive of all five tabs (this slice):** remount + RQ cache is enough once Links exist. Hidden trees would keep 12–15s polls alive. Revisit after 001–003.
- **SSR dehydrate / HydrationBoundary (this slice):** persist covers hard refresh for returning users; hosted bundle is per-user. Do not CDN-cache league HTML.
- **Caching `myRosterId` in zustand/localStorage outside RQ:** auth-wrong after sign-out / seat claim.
- **lucide barrel / unused recharts / manualChunks:** measure `npm run build` first; not a flicker source.
- **Google font self-host:** FOUT is real but secondary; do not block 001–005.
- **Optimistic start/sit (cell edits):** high leverage, separate plan after the workbook cache exists.
- **Projections keyed by roster length:** fold into the cell-edits plan, not this slice.
- **WebSockets for the draft clock:** a whole new transport for one screen. Read-path expiry (008) reuses the polling model already in place for live scoring.
- **Client-side timers firing the pick advance:** ten browsers racing the same write, and a closed laptop stalls the draft. The client displays time; the server advances.
- **Cron-only clock enforcement:** `/api/league/tick` is hourly, so a board could sit dead for 59 minutes. Kept as the backstop, not the mechanism.
- **Pausing the draft during trade negotiation:** ten managers can negotiate indefinitely and the draft never finishes. Refusing the on-clock pick costs nothing instead.
- **Trading future-season picks:** `ff_picks` has no season column; a much larger change and only interesting for dynasty leagues. Explicitly out of scope for 011.
- **Persisting mock draft results:** ephemeral by decision. If that turns out to be wrong it is a separate plan, not a tweak to 012.
- **Recency-weighting our own season average** (instead of a real projection feed): considered for 015 and rejected once the Sleeper feed was verified to return raw components. A weighted average of past performance is still backward-looking; a projection accounts for opponent and role.
- **Using `pts_ppr` from the projections feed directly:** simpler, and wrong in every league that is not full PPR. Score the components with `applyBook()`.
- **Unifying `applyLineup` (server) and `fillLineup` (client):** would mean either exporting from a `@ts-nocheck` file or making the trade preview server-only. Duplicated deliberately, with a comment in each.
- **A trade grade or score:** the projection is a season points-per-game proxy under a book; it can compare two players, not judge a deal. Descriptive copy only.
- **Routing the trade read line through a language model:** one short sentence over numeric inputs. A model adds latency and a chance of inventing a number. The model-written voice belongs in the desk (013/014).
- **Drag-and-drop in the trade composer:** a new dependency for an interaction that click-to-add already handles.
- **Four-team trades:** `proposeTrade` permits `sides.size > 2` but nobody has asked, and the tabbed roster column in 020 does not survive it.
- **Sunday inactives sweep (90-minute pre-kickoff refresh):** the daily player
  refresh already shipped, and the locked betting rule is that a bet placed
  before news breaks is fair. That removes the requirement entirely. Not planned.
- **Event-sourcing the league from `ff_events`:** diary, not source of truth.
  024 exposes reads; it does not replay state from events.
- **In-app chat / MCP SDK in 024:** catalog + read CLI first.
- **Generic free-text wager props:** closed `WagerKind` until conservation is
  pinned (022). A `total` market is the next kind, not "anything you describe."
- **Unbranding Grok `?install=1`:** platform. 026's coach never links it
  (that URL hides `/join`).
- **Per-league home-screen icons:** one origin ≈ one PWA.
- **Service worker / Web Push in this slice:** follow-up after a friend
  actually installs. Draft 4s poll stays the in-room transport.
- **Membership-gating every GET (023):** 023 only strips invite codes and
  foreign bids. Operator later asked for invite-only / email allowlist —
  that is a new plan, not a rewrite of 023.
- **Rewriting `AGENTS.md`:** sandbox still needs it. 025 adds
  `AGENTS.project.md`.
- **Deleting `grokPwaPlugin` / `PreviewHostBridge` / `public/__grok`:**
  platform. Skin lives beside them.
- **Export/backup dump, native Google OAuth, `deleteLeague`:** real holes,
  not this slice. Backup is the next self-host gap after 025.

## Suggested first execution

**Slice 2, if you want visible progress fastest:** `006` (30 min, unblocks
everything) → `007` (the board, most noticeable) → `011` (trading, independent)
→ `008` → `009` → `010` → `012`.

**With two executors:** one runs the draft chain `006 → 008 → 009 → 010`; the
other runs `007`, then `011`, then `013 → 014`. They touch different files —
the draft chain lives in `engine.server.ts`, while 011 is in `ops.server.ts` and
013/014 are in `dispatch.ts` and a new module.

## Suggested execution — slice 3

**Single executor:** `015` → `017` → `016` → `018` → `019` → `020` → `021`.
015 first because every number downstream depends on it; 018 is the first change
anyone will actually notice.

**Two executors:** one takes `015` (server, projections); the other takes `017`
then `016` (client, pure). They meet at `018`.

## Suggested execution — slice 4 (agent-native)

**DONE.** `024` `7f5a247` · `025` `f738a3b` · `026` `b918703`.

## Suggested execution — slice 5 (purse, door, click)

**DONE.** `027` `9f512b5` · `028` `fe3d1a6` · `029` `dd9bc53`.

## Suggested execution — slice 6 (door + leftovers)

**030 is DONE** (`4fd580c`). Remaining leftovers are **not** on the
headless-engine critical path:

`031` (pure tests) anytime · `034` then `036` (backup/delete) ·
`035` (Google) anytime · `032` when a week has a line · `037`
only after a human installed the PWA.

`034`/`036` share settings.tsx — do not run them in parallel.

## Sprints to the headless engine (do these)

North star: migrate in → any client (PWA, Codex, Claude, Grok)
speaks the same verbs. PWA is client zero, not the product.

### Sprint 1 — Honest loop (in-repo, no host yet)

**Parallel:** `038` · `040` · `039` · `031`

Then: `033` (CLI `placeWager --write`, needs 038).

Done when: an operator with `DATABASE_URL` can dump context and
the purse cannot mint on trade accept. Pull exists in the PWA.

### Sprint 2 — Local host (commish Codex on the box)

`042` (stdio MCP + `dispatch` + `AGENT_CORE`).

Needs 038 + 033 so the socket is not hollow.

Done when:

```
export DATABASE_URL=… OPENFF_USER=…
codex mcp add openff --command bun --args scripts/mcp.mjs
```

and “sit the injured RB” hits `sitPlayer`.

### Sprint 3 — Hosted host (a friend’s Codex)

`041` (tokens) then `043` (HTTP `/api/mcp`).

Done when:

```
export OPENFF_TOKEN=off_…
codex mcp add openff --url https://HOST/api/mcp --bearer-token-env-var OPENFF_TOKEN
```

Same `dispatch`. Cookie still for the PWA.

### Sprint 4 — Playbooks (features as files)

`044` — migrate / lineup / book skills. Copy into
`~/.codex/skills`, `~/.claude/skills`, `.grok/skills`.

Done when “migrate my sdiff league” is a skill over
`preview*` → `confirm: true` → `import*` (Sleeper / ESPN /
rebuild as they exist today).

### Sprint 4b — Migrate completeness (after the plug works)

`045` — one `ImportPack`, file always works, NFL.com → ESPN hop,
Sleeper prior season optional. **Yahoo OAuth only if the YDN app
is approved.** Do not block Sprints 1–4 on Yahoo.

### Sprint 5 — Self-host + season ops (off the critical path)

`034` → `036` · `035` · `032` · `037` (stop if no install).

### Not a sprint

Plugin marketplace, ChatGPT Actions, generative matchup UI in
*this* repo, voice host, `total` market, rename/leave/rotate
invite, `@open-ff/engine` npm extract.

## Findings considered and rejected (038 audit)

- **MCP SDK / in-app chat (038 slice):** was deferred until the
  catalog was callable. **041–044 is that later.** Still no desk
  chatbot.
- **Files as the league source of truth:** multi-manager money. Keep
  Postgres. Dump + catalog is the spirit of context.md.
- **`--user` as a hosted manager token:** operator CLI only. A hosted
  friend still uses Better Auth cookies. No PAT this slice.
- **Dispatch every catalogued read from argv:** `getAgentContext`
  covers the turn-start blob. Other reads stay HTTP / later.
- **Prompt pack / weekly-review feature:** prompts over verbs need
  verbs that run. After 038+033 have been used once.
- **Market registry / `total` / free-text props:** WagerKind stays
  `spread | moneyline` until 040's conservation is in and someone
  actually stakes.
- **Rename team / leave / rotate invite / adjust-FAAB / void-wager:**
  real CRUD holes, not this slice. They do not block sit + add +
  stake. List them; do not build them to look busy.
- **Draft / settings / FAAB-on-trade events:** diary is thin. Do not
  event-source. A later facts pass can add kinds; 038 already returns
  the last 20 rows as they are.

## Findings considered and rejected (041 audit)

- **A Codex / Claude / Grok plugin as three products:** one MCP
  server. Plugin is a later box around 042+044.
- **ChatGPT Actions / second OpenAPI surface:** MCP is the
  standard. Do not maintain two contracts.
- **Better Auth apiKey plugin:** do not rewrite `server.ts`. Own
  `ff_agent_tokens` table (041).
- **Expose all 67 tools on MCP day one:** `AGENT_CORE` only. Cora
  drowned on fat tool lists.
- **`userId` as a tool argument:** host env or `off_` token only.
- **`renderMatchupHtml` / in-repo generative UI:** a client. Not
  a verb.
- **Extract `@open-ff/engine`:** the boundary is `dispatch` +
  catalog. A package split before 043 works is a rewrite.

## Findings considered and rejected (022–026)

See the list above (event-sourcing, MCP SDK, free-text props, Grok install
unbrand, per-league icons, SW/push this slice).

## Open leftovers

Planned: **031–037** (self-host/ops), **038–040** (callable
catalog), **041–044** (token / MCP / skills). Do not re-audit as
unnamed findings.

Still unplanned, still real, still not this backlog:

- Rename team, leave/unclaim, rotate invite, update-bid, commish
  adjust-FAAB, commish void-wager.
- `/plugin` marketplace box (after someone besides us `mcp add`s).
- `total` market registry after someone has staked a spread.
- Yahoo OAuth importer until YDN review is actually approved.
- NFL.com HTML scrape (platform moving to ESPN for 2026).
