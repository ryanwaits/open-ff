# Plan 025: Make a stranger able to run a league

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat e6d44de..HEAD -- package.json src/lib/db.ts src/lib/auth/email-password.ts src/lib/auth/server.ts src/lib/auth/preview.ts src/routes/login.tsx startup.sh AGENTS.md`
> On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 023 (document `CRON_SECRET` the way tick actually works)
- **Category**: dx
- **Planned at**: commit `e6d44de`, 2026-08-18
  (reconciled: 023 gated tick behind `CRON_SECRET`; login pre-fills
  `LOCAL_SEED` and admits the in-memory wipe; PGLite still has no `dataDir`.
  Product name locked to **open-ff**. License locked to **MIT**.)

## Why this matters

The product claim is an open-source, self-hosted league desk. A commish
cannot pick it up: there is no README, no LICENSE, no `.env.example`,
PGLite is in-memory (restart deletes the league), Google/X buttons talk to
the Grok preview broker, and the package is still named
`app-builder-workspace`. `AGENTS.md` tells coding agents not to write a
`.env`. That is how a season dies on reboot.

## Current state

- No `README.md`, no `LICENSE`, no `.env.example`, no Docker
- `package.json:2` `"name": "app-builder-workspace"` — rename to **`open-ff`**
- `package.json:6` `"packageManager": "bun@1.3.10"`
- `package.json:17` `"test": "bun test src scripts"` — do not revert
- `src/lib/db.ts:106-118` — `new PGlite({ parsers })` **no `dataDir`**.
  After migrate it now calls `seedLocalAccount` (`db.ts:168-170`). Keep
  that seed; persist the dir.
- `src/lib/auth/email-password.ts:10` — `emailAndPasswordEnabled = true`
- `src/lib/auth/server.ts:73-84` — Google/X always fall back to preview
  client when `GROK_AUTH_*` unset
- `src/lib/auth/preview.ts:19-32` — preview client only valid on
  `*.grok-sandbox.com`
- `src/routes/login.tsx` — email form pre-fills `LOCAL_SEED`; copy still
  offers Google/X as if they work off-sandbox
- `src/routes/api/league/tick.ts` — if `CRON_SECRET` is set, requires
  `Authorization: Bearer` or `?secret=`. Document that.
- `startup.sh` — Grok sandbox (`/workspace`, curl tick every 180s)
- `vercel.json` already crons `/api/league/tick`

Email/password on localhost **does** work. That is the self-host path.

## Commands you will need

| Purpose   | Command             | Expected |
|-----------|---------------------|----------|
| Typecheck | `bun run typecheck` | exit 0   |
| Tests     | `bun test`          | pass     |
| Lint      | `bun run lint`      | exit 0   |

## Scope

**In scope**:
- `README.md` (create)
- `LICENSE` (create — **MIT**)
- `.env.example` (create)
- `package.json` — `name` only (`open-ff`; do not shuffle deps)
- `src/lib/db.ts` — PGLite `dataDir` when `DATABASE_URL` is unset
- `src/lib/auth/server.ts` — do **not** rewrite; only gate preview-broker
  providers so they are omitted unless `GROK_AUTH_CLIENT_ID` is set **or**
  the request host matches `PREVIEW_ALLOWED_HOSTS`. Prefer a small helper
  in `src/lib/auth/providers.ts` if that file already lists them.
- `src/routes/login.tsx` — hide Google/X when those providers are not
  actually configured; fix the copy
- `AGENTS.project.md` (create) — self-host + architecture notes for agents.
  Do **not** delete `AGENTS.md` (Grok preview still needs it).
- Optional: `docker-compose.yml` **only if** you can keep it to Postgres +
  app + a one-line tick sidecar **without** changing the Vite/Nitro build.
  If compose fights the template, skip it and document `bun run dev` +
  `DATABASE_URL` + cron instead.

**Out of scope**:
- Native Google OAuth (non-broker)
- Rewriting `src/lib/auth/server.ts` wholesale
- Export/backup dump
- Stripping `public/__grok/` or `grokPwaPlugin`
- Changing `startup.sh` paths that the sandbox revive depends on
- Implementing 023 (assume tick already checks `CRON_SECRET`, or document
  both states)

## Git workflow

- Commit: `docs: self-host path and persist the local database`
- Do NOT push

## Steps

### Step 1: Persist PGLite

In `src/lib/db.ts` `createPgliteSql`, pass a data directory:

```ts
const dir =
  process.env.PGLITE_DATA_DIR?.trim() ||
  // repo-local default so a commish reboot keeps the league
  new URL("../../data/pglite", import.meta.url).pathname;
```

Use the PGLite constructor option the installed version actually supports
(`dataDir` vs `dataDir` in constructor — read
`node_modules/@electric-sql/pglite` types, do not guess). Add `data/pglite/`
to `.gitignore`.

Keep the in-memory behavior if `PGLITE_EPHEMERAL=1` (sandbox preview can set
this in `startup.sh` **only if** you verify the sandbox still wants a wipe;
if unsure, default to disk and leave `startup.sh` alone).

**Verify**: `rg -n "dataDir|data_dir" src/lib/db.ts`. `bun run typecheck`.

### Step 2: Gate Grok broker buttons

Login should not offer Google/X unless they can succeed.

- If `GROK_AUTH_CLIENT_ID` is unset and host is not `*.grok-sandbox.com`,
  do not register / do not render those providers.
- Email form stays.
- Copy: this is a Ledger account. Google/X only when the host configured
  them. Hosting with Postgres keeps the same email account.

Do not print any secret. Do not copy preview client values into README.

**Verify**: `rg -n "Continue with" src/routes/login.tsx` still exists but is
behind a real configured-providers list. `bun run typecheck`.

### Step 3: README + env + license + package name

`README.md` must walk:

1. Need Bun 1.3 (see `packageManager`)
2. `bun install && bun run dev` → `http://127.0.0.1:8080`
3. `/login` email signup
4. `/new` → invite friends to **this** origin
5. Disk: without `DATABASE_URL`, data lives in `data/pglite` (survives
   restart). For real host: `DATABASE_URL=postgres://…` and
   `bun run db:migrate`
6. Required for a public host: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
   (https origin), `CRON_SECRET`, a cron `GET` with bearer every 1–5 min
7. Sleeper is the player/week pipe (outbound HTTPS). ESPN cookies are
   import-only. No member needs a Sleeper account
8. One deploy, many leagues
9. `bun test` / `bun run typecheck` / `bun run lint`

`.env.example` lists those keys as empty assignments, no values.

`LICENSE`: MIT, copyright year 2026, project name Ledger / open-ff.

`package.json` `"name": "ledger"` (or `open-ff` if you want the repo name —
pick one and use it in README).

`AGENTS.project.md`: 30–60 lines — primitives live in `src/lib/league`,
tools catalog in `src/lib/agent` (024), do not tick without secret, do not
edit `engine.server.ts` unless the plan says so, skin is 026.

**Verify**: files exist. README does not mention `/workspace` as the
commish path. No secret material.

### Step 4: Compose? only if cheap

If you write `docker-compose.yml`:

- `postgres:16` with a volume
- `app` builds/runs `bun run dev` or `bun run preview` on `8080`
- `tick` service: `wget`/`curl` `/api/league/tick` with `CRON_SECRET`
- No Traefik/Caddy unless already in the repo

If the Vite 8 / Nitro preview image is unclear, **skip compose** and put a
"systemd / cron" snippet in the README instead.

**Verify**: `docker compose config` exits 0 **or** no compose file.

## Test plan

- No new runtime tests required.
- Optional source-string: README mentions `CRON_SECRET` and `data/pglite`.

## Done criteria

- [ ] README exists and the stranger path works as written
- [ ] LICENSE exists
- [ ] `.env.example` exists and contains no secrets
- [ ] PGLite persists to disk by default
- [ ] Google/X are not offered on a generic localhost/VPS without broker env
- [ ] `package.json` name is not `app-builder-workspace`
- [ ] `AGENTS.md` still present (sandbox)
- [ ] `bun run typecheck` / `bun test` / `bun run lint` pass
- [ ] `plans/README.md` updated

## STOP conditions

- PGLite's installed API has no data directory option — stop and report
  rather than swapping to a different database library
- Gating providers requires rewriting `auth/server.ts` (frozen by comments)
  — put the gate in `providers.ts` / login UI only
- You think you need to delete `public/__grok`

## Maintenance notes

- Export/backup is still missing (rejected as this slice).
- Reviewer: the login copy must not claim Google works on a naked VPS.
- Sandbox preview: if disk persist breaks Grok live preview, use
  `PGLITE_EPHEMERAL=1` in `startup.sh` and say so in the commit message.
