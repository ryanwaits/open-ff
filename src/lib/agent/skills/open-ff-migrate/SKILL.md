---
name: open-ff-migrate
description: >
  Migrate a fantasy league into open-ff. Use when importing from Sleeper,
  ESPN, Yahoo, NFL.com, or a paste/PDF rebuild, or when the user says
  "import league", "migrate", "bring over my sleeper league", or
  "set up from ESPN".
---

# Migrate a league

Ceiling and invariants: [CATALOG.md](../../CATALOG.md),
[context-prompt.md](../../context-prompt.md). Start with
`getAgentContext` when a league already exists; for a fresh import,
ask the source first.

Every source becomes one import pack (teams, managers, slots, scoring,
rosters, weeks). After commit we are the source of truth — one-way
extract only. **Never invent manager emails** from these APIs; allowlist
is a post-import step the commish types in settings.

## Source decision tree

1. **Ask which source**, then pick a path. **File/paste is always
   option 2** if connect fails or the source is unsupported.

| Source | Connect | File fallback |
|---|---|---|
| **Sleeper** | League id → `previewImport` then `importLeague` (`confirm: true`) on MCP | Paste/PDF rebuild on PWA `/import` |
| **ESPN** | Public league id on PWA `/import`; if private, SWID+espnS2 **once** (not saved) | Same `/import` rebuild paste |
| **Yahoo** | OAuth **not shipped** (YDN app not approved) | Paste standings/rosters on `/import` |
| **NFL.com** | Do **not** scrape. Hop: espn.com/importnfl → our ESPN import | Or paste on `/import` |

2. **Sleeper (MCP):** call `previewImport` with the Sleeper id. Optional
   includeHistory=true walks at most one previous_league_id (records
   only). Show unmatched / warnings. Stop if the preview is messy.
3. After the human says yes, call `importLeague` with
   `confirm: true`. Never commit without that flag. Default
   includeHistory is false.
4. **ESPN / rebuild / Yahoo paste / NFL hop:** those commit verbs are
   not on the MCP socket. Tell them to use the PWA `/import` page
   (`previewEspn` / `importEspn` / `previewRebuild` / `importRebuild`
   run there). Never ask them to paste cookies into chat; never echo
   cookies. Never fetch `fantasy.nfl.com` HTML.
5. Optional invite allowlist: `addAllowlistEmail` is PWA settings
   only — not MCP. Point them at league settings. **No emails from
   Sleeper/ESPN/Yahoo APIs.**

Do not invent import tools. Do not call tick. Do not sync back to the
old host after import.
