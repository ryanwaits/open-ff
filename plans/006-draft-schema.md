# Plan 006: Draft schema — clock deadline, sticky autodraft, and a pick queue

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9948a37..HEAD -- migrations/ src/lib/league/engine.server.ts src/lib/league/ops.server.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `9948a37`, 2026-08-17

## Why this matters

Plans 007–012 build a real draft room: a board, a 90-second pick clock, sticky
autodraft, a queue, and mid-draft trading. Four of those need columns that do
not exist yet. Landing all four in one migration now means the later plans are
pure application code and never have to stop to add a column — and it avoids a
second migration file for the same feature, which is churn a reviewer has to
read twice.

Nothing user-visible changes in this plan. That is the point: it is the safest
possible first step and it unblocks everything after it.

## Current state

`ff_draft` has exactly three columns — no notion of time
(`migrations/0002_leagues.sql:57-61`):

```sql
create table if not exists ff_draft (
  league_id text primary key references ff_leagues(id) on delete cascade,
  status text not null default 'pending',
  pick_no int not null default 1
);
```

`ff_picks` has no `original_roster` column in the migration
(`migrations/0002_leagues.sql:63-71`):

```sql
create table if not exists ff_picks (
  league_id text not null,
  pick_no int not null,
  round int not null,
  roster_id int not null,
  player_id text,
  picked_at timestamptz,
  primary key (league_id, pick_no)
);
```

…but it **is** added at runtime by `ensureOpsSchema`
(`src/lib/league/ops.server.ts:60`):

```ts
`alter table ff_picks add column if not exists original_roster int`,
```

So the repo already uses **two** schema mechanisms:

1. **`migrations/*.sql`** — the durable source. Applied by
   `scripts/migrate.mjs` against `DATABASE_URL` during `npm run build`, and by
   the PGLite fallback at startup via `import.meta.glob("/migrations/*.sql")`
   (`src/lib/db.ts:130-137`). Files are tracked in `_migrations` and applied
   once.
2. **Runtime `ensure*Schema()` helpers** — `ensureOpsSchema`
   (`ops.server.ts:38-89`), `ensureWagerSchema`
   (`src/lib/league/wagers.server.ts`), `ensureEventSchema`
   (`src/lib/league/events.server.ts`). These run `create table if not exists` /
   `alter table ... add column if not exists` on first use and memoize with a
   module-level `ready` flag.

**Use the migration file** for this plan. The runtime helpers exist for tables
added after the migration convention was established; the draft is core schema
that belongs in `migrations/`. Highest existing migration is
`migrations/0007_dispatch.sql`, so the new file is `0008_draft_clock.sql`.

Both mechanisms are idempotent, so a column added in a migration and also
guarded by an `add column if not exists` elsewhere is harmless — but do not add
a runtime duplicate in this plan.

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `npm run typecheck` | exit 0              |
| Tests     | `npm test`          | all pass            |
| Build     | `npm run build`     | exit 0              |

No new packages.

## Scope

**In scope** (the only files you should modify or create):
- `migrations/0008_draft_clock.sql` (create)

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/league/engine.server.ts` — reading or writing the new columns is
  plans 008–010. This plan adds storage only.
- `src/lib/league/ops.server.ts` — do not add these columns to
  `ensureOpsSchema`; the migration is the single source for them.
- `migrations/0002_leagues.sql` — never edit an applied migration. Files are
  recorded in `_migrations` by name and will not re-run, so an edit silently
  does nothing on any database that has already seen it.
- Any `ff_wagers` / `ff_events` / `ff_pool` table — unrelated features.

## Git workflow

- Stay on the current branch. Do not push.
- One commit: `feat: add draft clock, autodraft and queue columns`

## Steps

### Step 1: Write the migration

Create `migrations/0008_draft_clock.sql`:

```sql
-- Draft room: a per-pick clock, sticky autodraft, and a pick queue.
-- See plans/007-014 for the features these support.

-- When the pick currently on the clock expires. Null means no clock is
-- running: a draft that has not started, or one the commissioner paused.
alter table ff_draft add column if not exists pick_deadline timestamptz;

-- Per-league pick length. 90s is the locked default (plans/008).
alter table ff_draft add column if not exists pick_seconds int not null default 90;

-- Sticky. Set when a manager's clock expires (plans/009), cleared only by the
-- manager. A roster with this set never starts a clock — it picks immediately.
alter table ff_rosters add column if not exists autodraft int not null default 0;

-- The manager's ranked wish list, which doubles as autodraft order (plans/010).
-- rank is ascending: 1 is taken first.
create table if not exists ff_queue (
  league_id text not null,
  roster_id int not null,
  player_id text not null,
  rank int not null,
  primary key (league_id, roster_id, player_id)
);

create index if not exists ff_queue_order_idx
  on ff_queue (league_id, roster_id, rank);
```

Match the existing files' style: lowercase SQL keywords, `if not exists`
everywhere, a comment above each non-obvious column. Read
`migrations/0005_ops.sql` for the house style before writing.

**Verify**: `ls migrations/` → shows `0008_draft_clock.sql`.
`grep -c "if not exists" migrations/0008_draft_clock.sql` → `5`.

### Step 2: Apply it locally and confirm the columns exist

The PGLite fallback applies `migrations/*.sql` at startup, so a build is the
cheapest way to prove the file parses. `npm run build` runs `vite build` then
`scripts/migrate.mjs`; with no `DATABASE_URL` the migrator prints a skip line
and exits 0, which is expected locally.

```
npm run build
```

**Verify**: exit 0, and the output ends with
`[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).`

If the SQL is malformed, PGLite will not surface it during `vite build` — it
only runs at server startup. So also confirm the file is valid SQL by reading it
once more against `migrations/0005_ops.sql` for shape. Do **not** stand up a
database harness for this.

### Step 3: Confirm nothing else changed

```
git status --short
```

**Verify**: exactly one new file, `migrations/0008_draft_clock.sql`. No
modified files.

## Test plan

No new tests. This plan adds storage with no behaviour attached, and the repo
has no database test harness — `npm test` runs `node --test 'scripts/**/*.test.mjs'`
(see `package.json`), which covers build scripts, not the engine. Standing one up
is out of scope here; plans 008–010 verify the columns through the application
code that reads them.

- `npm test` must stay green (it should be unaffected).

## Done criteria

ALL must hold:

- [ ] `migrations/0008_draft_clock.sql` exists and adds: `ff_draft.pick_deadline`,
      `ff_draft.pick_seconds`, `ff_rosters.autodraft`, table `ff_queue`, index
      `ff_queue_order_idx`
- [ ] `npm run build` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0
- [ ] `git status --short` shows only the one new file
- [ ] No existing migration file was edited (`git diff --name-only 9948a37..HEAD -- migrations/`
      lists only `0008_draft_clock.sql`)
- [ ] `plans/README.md` 006 → DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `migrations/0008_draft_clock.sql` already exists, or the highest existing
  migration is no longer `0007_dispatch.sql` — another plan or session added
  one. Renumber only after confirming with the operator; a duplicate number
  breaks the `_migrations` name tracking.
- `ff_rosters` does not exist in `migrations/` under that name.
- You are tempted to also add these columns to `ensureOpsSchema` "to be safe."
  Do not — one source per column. If you believe the migration will not run in
  some environment, report that instead.
- `npm run build` fails for a reason other than a pre-existing failure. Confirm
  by stashing your change and re-running.

## Maintenance notes

- **`pick_seconds` has no settings UI yet.** Plan 008 reads it; exposing it to
  the commissioner is deliberately deferred. Until then every league gets 90s.
- **`autodraft` is on `ff_rosters`, not `ff_draft`** — it is a property of a
  manager in a league, and a later mock-draft or second-season draft should not
  inherit it. Plan 009 is where it gets set and cleared.
- **`ff_queue` has no foreign keys.** Neither does `ff_picks` or `ff_claims` in
  this repo; matching that is deliberate, since rosters are addressed by
  `(league_id, roster_id)` rather than a surrogate key.
- A reviewer should check that no applied migration was edited, and that the
  new file uses `if not exists` throughout so re-running against a partially
  migrated database is safe.
