# Plan 044: Ship playbooks so a host knows how to migrate and sit

> **Executor instructions**: Follow this plan step by step. Skills are
> markdown. Do not invent tools. If a STOP fires, report.
>
> **Drift check (run first)**: `git diff --stat 735b0ba..HEAD -- src/lib/agent src/lib/league/fns.ts README.md`
> On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/042-mcp-stdio.md (tools exist to playbook)
- **Category**: direction
- **Planned at**: commit `735b0ba`, 2026-08-19

## Why this matters

MCP is the plug. Without a skill, the model dumps 20 tools into
context and guesses. Cora drowned that way. Skills are the features:
migrate, set lineup, read the book. They compose `AGENT_CORE`. They
are not a second engine and not a desk chatbot.

A host loads them as files (Claude/Grok/Codex each have a skills
dir). We author **once** under `src/lib/agent/skills/` and tell the
human to copy or symlink. Optional: also drop the same files in
`.grok/skills/` so this repo’s Grok session auto-loads them.

## Current state

- `src/lib/agent/CATALOG.md` + `context-prompt.md` — ceiling and
  invariants. Skills should **link** those, not fork them.
- Import fns (`fns.ts:271-309`): `previewImport` / `importLeague`,
  `previewEspn` / `importEspn`. UI is `/import` (three sources).
  ESPN cookies must never be logged (catalog already says so).
- After 042, `importLeague` dispatch requires `confirm === true`.
  Skills must say: preview first, then commit with `confirm: true`.
- No `src/lib/agent/skills/` yet.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Tests | `bun test src/lib/agent` | pass |
| Presence | `ls src/lib/agent/skills/*/SKILL.md` | three files |

## Scope

**In scope**:
- `src/lib/agent/skills/open-ff-migrate/SKILL.md`
- `src/lib/agent/skills/open-ff-lineup/SKILL.md`
- `src/lib/agent/skills/open-ff-book/SKILL.md`
- Same three copied or linked under `.grok/skills/<name>/SKILL.md`
  (project scope, so Grok in this repo sees them)
- `src/lib/agent/context-prompt.md` — one paragraph: “features are
  the skills in `./skills`”
- README: where to copy for Codex (`~/.codex/skills`) and Claude
  (`~/.claude/skills` or `.claude/skills`)
- If `importLeague` dispatch does not yet require `confirm`, add
  that check in `dispatch.ts` (042 contract). Do **not** change
  ESPN logging.

**Out of scope**:
- New import sources
- A Grok `/plugin` marketplace listing
- Voice / generative UI clients
- CRUD holes (rename, leave, rotate invite)
- Registering extra MCP tools

## Git workflow

- Branch: current
- Commit: `docs: add migrate, lineup, and book agent skills`
- Do NOT push

## Steps

### Step 1: Three SKILL.md files

Frontmatter: `name` + `description` with trigger phrases (required
for Grok auto-invoke). Body: numbered steps, **only** `AGENT_CORE`
ids, link to `CATALOG.md` / `context-prompt.md` with relative paths.

**open-ff-migrate**
1. Ask which source: Sleeper id, ESPN (warn: cookies in the tool
   args, never echo them), or paste/PDF rebuild.
2. `previewImport` / `previewEspn` / `previewRebuild`.
3. Show unmatched names. Stop if messy.
4. `importLeague` / `importEspn` / `importRebuild` with
   `confirm: true` only after the human says yes.
5. Optional `addAllowlistEmail` — **not in AGENT_CORE**. If missing,
   tell them to use the PWA settings. Do not invent a tool.

**open-ff-lineup**
1. `getAgentContext`.
2. `getTeam` + `getWeekProjections` (if projections is not in
   CORE, use context + `getTeam` only and say so).
3. Propose sits/starts. Wait.
4. `sitPlayer` / `startPlayer`. Undo is the reverse pair.

**open-ff-book**
1. `getAgentContext` + `getBook`.
2. Never fade the user’s own roster (engine also blocks).
3. `placeWager` / `pullWager`. Stake in whole dollars.

**Verify**: each SKILL.md contains `getAgentContext` and does
**not** contain `tickAllLeagues`. Migrate skill contains
`confirm: true`.

### Step 2: Grok copies + README

Copy or symlink into `.grok/skills/open-ff-migrate` (etc). README
short block:

```
# Codex:  cp -R src/lib/agent/skills/* ~/.codex/skills/
# Claude: cp -R src/lib/agent/skills/* ~/.claude/skills/
# Grok:   already in .grok/skills/ of this repo; else ~/.grok/skills/
```

**Verify**: `ls .grok/skills/open-ff-lineup/SKILL.md`.

## Test plan

- `scripts/skills-core.test.mjs`: every SKILL.md tool id mentioned
  in backticks is in `AGENT_CORE` or explicitly listed as “PWA
  only” (`addAllowlistEmail`). Pattern: catalog markdown test.

## Done criteria

- [ ] Three skills exist in `src/lib/agent/skills`
- [ ] Grok copies exist
- [ ] Skill test: no invented tool ids
- [ ] README copy instructions
- [ ] `bun test src/lib/agent` pass

## STOP conditions

- You add a createServerFn “because the skill needs it”
- You paste ESPN cookie examples into a skill file
- 042 `AGENT_CORE` does not include the verbs a skill names —
  either add the id to CORE (small, ok) or weaken the skill;
  do not silently document a 68th tool

## Maintenance notes

- A later `/plugin` box (unplanned) is these files + an MCP config
  snippet. Do not build it here.
- Reviewer: reject a skill that tells the model to call tick.
