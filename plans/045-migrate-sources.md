# Plan 045: One import pack, four sources, file always works

> **Executor instructions**: This is a **source-matrix + skill routing**
> plan, not “build Yahoo OAuth this week.” Do the spike in Step 0
> before writing a Yahoo client. If a STOP fires, report.
>
> **Drift check (run first)**: `git diff --stat 735b0ba..HEAD -- src/lib/league/engine.server.ts src/lib/data/sleeper.server.ts src/lib/data/espn-ff.server.ts src/lib/league/rebuild.ts src/lib/agent/skills src/routes/import.tsx`

## Status

- **Priority**: P1
- **Effort**: L (file + Sleeper history = M; Yahoo OAuth = L and gated)
- **Risk**: MED
- **Depends on**: plans/044-agent-skills.md (migrate skill exists over
  today’s three verbs)
- **Category**: direction
- **Planned at**: commit `735b0ba`, 2026-08-19

## Why this matters

Onboarding is “bring SDIFFL over,” not “create an empty desk.” The
must-haves are **teams + managers**, **league settings**, and
**current rosters** (pre-draft empty, post-draft, or mid-season).
History (this season’s weeks, then prior seasons) is the
nice-to-have. Two ingest modes must both work at the agent/UX
layer: **connect** (API / cookies) and **file/paste**. Every source
funnels through `preview* → confirm → import*`.

This stretch does **not** scrape NFL.com. It does **not** invent
emails for allowlist. It does **not** block 041–044.

## Current state (already in the engine)

| Source | Verbs | Connect | File | Teams | Settings | Rosters | This-season weeks | Prior seasons |
|---|---|---|---|---|---|---|---|---|
| Sleeper | `previewImport` / `importLeague` | league id, no auth | no | yes | scoring + slots + playoff week | yes | yes (`matchups/1..last`) | **no** (`previous_league_id` unused) |
| ESPN | `previewEspn` / `importEspn` | public **or** SWID+espnS2 one-shot, not saved | recap paste via rebuild | yes | scoring items + slots | yes (ESPN→Sleeper ids) | yes (`mMatchupScore`) | one year picker only |
| Rebuild | `previewRebuild` / `importRebuild` | — | paste, PDF, known recap | yes | scoring **preset only** (ppr/half/std) | name-matched | snap W-L/PF if in the paste | no |
| Yahoo | none | — | only via rebuild if they paste | — | — | — | — | — |
| NFL.com | none | — | only via rebuild | — | — | — | — | — |

Sleeper pack: `sleeper.server.ts` `loadImportPack` (league, users,
rosters, weekly matchups). Draft picks / transactions / brackets
are **not** copied (`engine.server.ts` marks draft `complete` if
anyone has players).

ESPN pack: `espn-ff.server.ts` `loadEspnImportPack` views
`mTeam&mRoster&mSettings&mMatchupScore`. No `mDraftDetail`. Cookies
used once.

Rebuild: teams/managers/names/optional records. Settings are a
three-way preset, not a full book.

## Locked product rules (do not violate)

1. **Canonical pack.** Every source becomes one JSON shape (teams,
   managers, slots, scoring book, spots, weeks). Preview renders
   that. Import commits that. Do not grow a fourth UI.
2. **File is the universal fallback.** If connect fails (private,
   review, shutdown), the skill says “paste a recap / roster dump
   / PDF.” Rebuild already is that door.
3. **Connect never stores secrets.** ESPN cookies and future Yahoo
   tokens are request-scoped. Sparkle rule.
4. **NFL.com = hop, don’t scrape.** 2026 season-long NFL Fantasy
   migrates **to ESPN**. Tell the commish: espn.com/importnfl, then
   our ESPN import. Direct `fantasy.nfl.com` scrape is ToS + a
   dying site.
5. **No manager emails from these APIs.** Sleeper `display_name`,
   ESPN `displayName`, Yahoo nickname/`guid`. Allowlist is a
   **post-import** step the commish types. Do not block migrate on
   emails.
6. **Must-have vs nice.** Ship: seats, names, settings, current
   roster, this-season schedule/scores if the source has them.
   Walk prior seasons only when the source has a cheap pointer
   (Sleeper `previous_league_id`). Do not promise a 2015 archive.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test src/lib/league src/lib/agent` | pass |

## Scope

**In this plan (after 044):**

- Document the canonical `ImportPack` type in
  `src/lib/league/import-pack.ts` and make Sleeper / ESPN / Rebuild
  **emit it** (adapters). Preview/import keep existing fn ids.
- Sleeper: optional `previous_league_id` walk **one** prior season
  into facts/week_results if cheap (STOP if it doubles import time
  without a flag). Flag `includeHistory: boolean` default false.
- ESPN: keep cookie one-shot; add `mDraftDetail` only if preview
  shows 0 players post-draft (STOP if player-id map blows up).
- Rebuild: accept a second file flavor if we find a stable CSV
  (do not invent columns). Prefer “paste what you have.”
- Migrate skill (044): routing table — Sleeper id → connect;
  ESPN id → public then cookies; Yahoo → “OAuth not shipped, paste
  standings/rosters”; NFL → “import to ESPN first, or paste.”
- README: source matrix (copy the table above, updated).

**Out of scope until Yahoo access is actually approved:**

- Yahoo OAuth app + `/previewYahoo` / `/importYahoo`
- Storing refresh tokens
- NFL.com HTML scrape / Selenium
- Multi-year walker for ESPN (loop 2019–2025)
- Email scrape

## Git workflow

- Branch: current
- Commit: `feat: canonicalize league import packs`
- Do NOT push

## Steps

### Step 0: Spike (read-only, 30 min)

Re-read this file’s matrix. Confirm Yahoo developer portal still
requires review (`sports.yahoo.com/developer/access/`). If Yahoo
is approved in *this* operator’s account, STOP and report — then
a follow-up plan adds `previewYahoo`. If not, do not start OAuth.

**Verify**: you wrote one line in the PR/body: “Yahoo OAuth:
approved / not approved.”

### Step 1: `ImportPack` type + adapters

One type:

```ts
type ImportPack = {
  source: "sleeper" | "espn" | "rebuild" | "yahoo";
  sourceLeagueId: string;
  name: string;
  season: string;
  status: "pre_draft" | "drafting" | "in_season";
  book: ScoringBook;
  slots: string[];
  playoffTeams: number;
  currentWeek: number;
  teams: Array<{
    rosterId: number;
    teamName: string;
    manager: string;
    ownerKey: string | null; // sleeper user / espn guid / yahoo guid
    players: Array<{ playerId: string; starterSlot: string | null }>;
  }>;
  weeks: Array<{
    week: number;
    games: Array<{ matchupId: number; home: number; away: number | null }>;
    results: Array<{ rosterId: number; points: number }>;
  }>;
};
```

Sleeper/ESPN/rebuild loaders return this. `importSleeperLeague` /
`importEspnLeague` / `importRebuild` share a `commitImportPack`
writer. **Do not** rewrite scoring. If a loader already returns a
superset, map — don’t duplicate SQL inserts.

**Verify**: `rg -n "commitImportPack" src/lib/league`. Three
importers call it.

### Step 2: Skill routing

Update `open-ff-migrate` SKILL.md with the four-source decision
tree (NFL hops to ESPN). File/paste is always option 2.

**Verify**: skill mentions NFL.com → ESPN hop and “no emails.”

### Step 3: Sleeper history flag (optional, default off)

`includeHistory` on `importLeague`. If true, follow at most **one**
`previous_league_id` and merge week_results / facts. If the
previous league 404s, warn in preview, still commit current.

**Verify**: default import does not call a second league unless
the flag is set.

## Done criteria

- [ ] One `ImportPack` / `commitImportPack`
- [ ] File fallback still works with no connect
- [ ] NFL is not scraped
- [ ] Yahoo not implemented unless Step 0 said approved
- [ ] Skill routing matches the matrix
- [ ] `bun run typecheck` + importer tests pass

## STOP conditions

- You start a Yahoo OAuth client without an approved YDN app
- You fetch `fantasy.nfl.com` HTML
- You persist espnS2 / Yahoo refresh tokens
- Unifying writers requires rewriting `engine.server.ts` scoring —
  stop and keep three writers behind a thin mapper instead

## Maintenance notes

- Yahoo follow-up (unplanned until approval): `previewYahoo` /
  `importYahoo` emitting the same `ImportPack`. Attribution:
  “Fantasy data provided by Yahoo Fantasy.”
- Reviewer: reject an importer that promises manager emails or
  10-year ESPN history.
