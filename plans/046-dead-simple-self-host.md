# Plan 046: A non-technical commish can keep a league up all season

> **Executor instructions**: This is the self-host *product* path, not
> a SaaS. One origin, one commish (or a few), **N leagues**. If a STOP
> fires, report. Do not invent a multi-tenant control plane we operate.
>
> **Drift check (run first)**: `git diff --stat 9af8eff..HEAD -- README.md package.json vercel.json src/routes/api/league/tick.ts src/lib/db.ts Dockerfile docker-compose.yml`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/025-self-host-pickup.md (DONE — bun + README
  + disk PGLite; still not one-click)
- **Category**: dx
- **Planned at**: commit `9af8eff`, 2026-08-19 (reconciled; still no Docker.
  README now has local + hosted MCP install. Tick is still cron-only
  off Vercel.)

## Why this matters

The product is **not** a hosted open-ff.com. A commish (often
non-technical) should pay **only** a host (Vercel / Fly / Railway /
a $6 VPS), run **as many leagues as they want** on that origin
(`/new` or import per league), invite friends per invite code, and
not think about cron, Bun, or SportsDataIO. Today 025 is “you know
bun and systemd.” That is still a developer README. Tick is the
season-killer: if nobody hits `/api/league/tick`, every league on
the box stalls (tick already walks all leagues).

## Current state

- `bun run dev` + PGLite `data/pglite` works locally.
- Public host README: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `CRON_SECRET`, optional `DATABASE_URL`.
- `vercel.json` crons tick hourly. Fine **if** they deploy to
  Vercel. Elsewhere they must wire systemd/cron (README).
- No Dockerfile / compose (025 left it optional and skipped).
- **036 delete is DONE.** 034 backup is still the “disk dies” hole.
  `package.json` has `db:repair` for a wedged PGLite — not a backup.
- Sleeper player/week pipe is outbound HTTPS, no key. One league
  will not 429.

## Locked rules

1. **No first-party SaaS.** No shared neon we operate.
2. **No paid stats.** Sleeper + disk `data/players-slim.json` +
   ESPN scoreboard as now. If Sleeper 429s, last cache stands;
   the ledger does not die.
3. **Tick must not be a homework assignment.** Long-running
   process (Docker/VPS): in-process interval. Vercel: keep
   `vercel.json` cron. Do not require the commish to paste a
   crontab.
4. **Postgres is optional.** A volume + PGLite is enough for a
   handful of 10–12 team leagues. `DATABASE_URL` only if the host
   has no durable disk (Vercel → Neon, still *their* hosting bill).
5. **Email/password is the login.** Do not block on 035 Google.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck | `bun run typecheck` | exit 0 |
| Dev | `bun run dev` still works without Docker | 8080 up |

## Scope

**In scope**:
- `Dockerfile` — bun, `npm run`/`bun` start on `0.0.0.0:8080`,
  persist `/data` (map `PGLITE_DATA_DIR=/data/pglite`)
- `docker-compose.yml` — `app` + volume + **tick is in-process**
  (no second service unless you cannot hook the interval)
- In-process tick: if `OPENFF_SELF_TICK=1` (default in Docker),
  `setInterval` → same handler as `/api/league/tick` every 2 min.
  Vercel: do **not** set that env (cron already fires). Guard
  with a single-flight lock so interval + HTTP cron cannot
  double-advance.
- README **“Put it on the internet”** rewritten as: Railway /
  Fly / Compose, 3 env vars, invite URL. Hide systemd as
  “advanced.”
- Generate `BETTER_AUTH_SECRET` in compose if unset (openssl /
  bun random) so they don’t invent hex.

**Out of scope**:
- Our hosted multi-tenant
- Paid SportsDataIO
- Kubernetes
- 035 Google
- Changing Sleeper import

## Git workflow

- Branch: current
- Commit: `feat: docker self-host with in-process tick`
- Do NOT push

## Steps

### Step 1: Dockerfile + volume

App listens 8080. `PGLITE_DATA_DIR=/data/pglite`. Copy
`data/players-slim.json` (and other `data/*.json` the app
reads) into the image. Healthcheck: `GET /`.

**Verify**: `docker compose up` (or document why the executor
could not run Docker) — logs show listen, PGLite dir created.

### Step 2: In-process tick

Small module called from server boot (not from a client
bundle). `OPENFF_SELF_TICK=1` → every 120s call the same
`tickAllLeagues` path tick.ts uses. Skip if a tick is already
running. Compose sets the env. `vercel.json` unchanged.

**Verify**: `rg -n "OPENFF_SELF_TICK" src`. tick.ts still
respects `CRON_SECRET` for HTTP.

### Step 3: README for humans

Top path:

```
git clone …
cp .env.example .env   # compose can fill secrets
docker compose up -d
# open https://YOUR_HOST  → /login → /new → invite
```

One short “Vercel” alt: set the four env vars, cron is free.
Say Neon is part of that host bill if they have no disk.

**Verify**: README does not lead with systemd.

## Done criteria

- [ ] Compose brings the app up with durable PGLite
- [ ] Tick runs without a crontab on that path
- [ ] Vercel cron path unchanged
- [ ] README is a commish recipe, not a distro tutorial
- [ ] `bun run typecheck` pass

## STOP conditions

- You would require `DATABASE_URL` for Docker
- You add a control plane / admin of *other people’s* leagues
- Tick interval lives in the browser
- You vendor a paid stats SDK

## Maintenance notes

- 034 (backup JSON) is the “laptop died” companion. Do 034
  soon after this.
- Reviewer: reject a compose file that needs the user to
  install bun on the host.
