---
name: open-ff-migrate
description: >
  Migrate a fantasy league into open-ff. Use when importing from Sleeper,
  ESPN, or a paste/PDF rebuild, or when the user says "import league",
  "migrate", "bring over my sleeper league", or "set up from ESPN".
---

# Migrate a league

Ceiling and invariants: [CATALOG.md](../../CATALOG.md),
[context-prompt.md](../../context-prompt.md). Start with
`getAgentContext` when a league already exists; for a fresh import,
ask the source first.

## Steps

1. Ask which source: **Sleeper** league id, **ESPN**, or paste/PDF
   **rebuild**.
2. **Sleeper (MCP):** call `previewImport` with the Sleeper id. Show
   unmatched names. Stop if the preview is messy.
3. After the human says yes, call `importLeague` with
   `confirm: true`. Never commit without that flag.
4. **ESPN or rebuild:** those verbs are not on the MCP socket. Tell
   them to use the PWA `/import` page
   (`previewEspn` / `importEspn` / `previewRebuild` / `importRebuild`
   run there). Never ask them to paste cookies into chat; never echo
   cookies.
5. Optional invite allowlist: `addAllowlistEmail` is PWA settings
   only — not MCP. Point them at league settings.

Do not invent import tools. Do not call tick.
