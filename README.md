# open-ff

A self-hosted fantasy football league desk. Sign in, create a league, invite
friends to **this** origin. One deploy can host many leagues.

## Put it on the internet

You need Docker. You do **not** need Bun on the host.

```sh
git clone https://github.com/YOUR_ORG/open-ff.git
cd open-ff
cp .env.example .env   # optional — compose fills a session secret if blank
docker compose up -d
```

Open `http://YOUR_HOST:8080` → `/login` → `/new` → invite friends.

| Env | Notes |
|-----|--------|
| `BETTER_AUTH_URL` | Public https origin (no trailing slash). Default `http://localhost:8080`. |
| `BETTER_AUTH_SECRET` | Session signing. Blank → entrypoint generates one and keeps it on the data volume (`/data/better-auth-secret`). |
| `CRON_SECRET` | Optional on Docker (in-process tick). Still gates HTTP `/api/league/tick`. Unset = that route is public — set it on a public host. |

Compose sets `OPENFF_SELF_TICK=1` so the league clock runs inside the
container every 2 minutes — no crontab. League data lives on the
`openff-data` volume (`PGLITE_DATA_DIR=/data/pglite`). Do **not** set
`DATABASE_URL` unless you want external Postgres.

After a season (or before you wipe a box), open **Settings → Download
backup** for a JSON export of the league.

Email/password is the self-host login. Google/X only appear when
`GROK_AUTH_CLIENT_ID` is set (or on the Grok live preview).

### Vercel instead

Four env vars on the project: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`CRON_SECRET`, and `DATABASE_URL` (Neon or any Postgres — Vercel has no
durable disk). Cron is free via `vercel.json` (`/api/league/tick` hourly).
Do **not** set `OPENFF_SELF_TICK` there. Then `bun run db:migrate` runs as
part of `bun run build`.

## Local without Docker

You need [Bun](https://bun.sh) 1.3 (see `packageManager` in `package.json`).

```sh
bun install
bun run dev
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080).

1. Go to `/login` and sign in with email (or create an account).
2. Go to `/new`, make a league, and invite friends to this origin.
3. Without `DATABASE_URL`, the league lives in `data/pglite` and survives
   restart. For Postgres, set `DATABASE_URL=postgres://…` and run
   `bun run db:migrate`. If `bun run dev` dies with a PGLite `Aborted()`
   WASM panic, the WAL checkpoint is corrupt — `bun run db:repair`.

A local seed account is created on an empty email table. Copy
`.env.example` to `.env` and fill only what you need.

## Advanced: tick without Docker

The league clock is `GET` (or `POST`) `/api/league/tick`. When
`CRON_SECRET` is set, the request must send that value as
`Authorization: Bearer …` or `?secret=`.

Long-lived `bun run dev` can set `OPENFF_SELF_TICK=1` for an in-process
interval (same as Docker). Otherwise wire a cron or systemd timer:

```cron
*/2 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://YOUR_HOST/api/league/tick
```

```ini
# /etc/systemd/system/open-ff-tick.service
[Service]
Type=oneshot
EnvironmentFile=/etc/open-ff.env
ExecStart=/usr/bin/curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" https://YOUR_HOST/api/league/tick
```

```ini
# /etc/systemd/system/open-ff-tick.timer
[Timer]
OnCalendar=*:0/2
Persistent=true
[Install]
WantedBy=timers.target
```

If `CRON_SECRET` is unset, the tick route is public — do not do that on a
public host unless you rely only on the in-process clock behind a firewall.

## Players and imports

Sleeper is the player/week pipe (outbound HTTPS). No member needs a
Sleeper account. ESPN cookies are import-only; they are not used at
runtime after import.

Every source becomes one canonical import pack, then commits into the
ledger. Connect is one-way extract — we do not keep polling the old host.
File/paste rebuild is always the fallback when connect fails.

| Source | Connect | File | Teams | Settings | Rosters | This-season weeks | Prior seasons |
|---|---|---|---|---|---|---|---|
| Sleeper | league id, no auth | rebuild paste | yes | scoring + slots + playoff week | yes | yes (`matchups/1..last`) | optional one `previous_league_id` via `includeHistory` (default off) |
| ESPN | public **or** SWID+espnS2 one-shot, not saved | rebuild paste | yes | scoring items + slots | yes (ESPN→Sleeper ids) | yes (`mMatchupScore`) | one year picker only |
| Rebuild | — | paste, PDF, known recap | yes | scoring **preset** (ppr/half/std) | name-matched | snap W-L/PF if in the paste | no |
| Yahoo | OAuth not shipped | paste via rebuild | via paste | via paste | via paste | no | no |
| NFL.com | hop: espn.com/importnfl → ESPN import (no HTML scrape) | paste via rebuild | via ESPN/paste | via ESPN/paste | via ESPN/paste | via ESPN | no |

Manager emails are never pulled from these APIs — allowlist is typed
post-import by the commissioner.

## Book

Managers can stake FAAB on matchups when the commissioner turns betting **On**
under **The book** in league settings (then Save). Open Matchups to see the
line — live prices open the wager ticket; preseason shows an honest “no price”
empty state.

With `bun run dev` up:

```sh
bun scripts/wager-qa.mjs
```

Signs in with the local seed, creates a throwaway league, enables the book, and
screenshots either a placed ticket or the no-price panel under `screenshots/`.

## Agent hosts (local)

Point Codex / Claude / Grok at the same catalog over MCP stdio (hosted Postgres only — bun cannot boot PGLite):

```sh
export DATABASE_URL=postgres://…
export OPENFF_USER=<your user id>
codex mcp add openff --command bun --args scripts/mcp.mjs
# Claude: claude mcp add openff -- bun scripts/mcp.mjs
# Grok:   grok mcp add openff -- bun scripts/mcp.mjs
```

`OPENFF_USER` is the Better Auth `user.id` (copy from the `user` table / local seed until settings shows it).

## Agent hosts (hosted)

Same `AGENT_CORE` catalog over Streamable HTTP in **JSON response mode** (request/response; no SSE — Vercel-friendly) with a personal `off_` token (mint in the app; 041):

```sh
export OPENFF_TOKEN=off_…
codex mcp add openff --url https://HOST/api/mcp --bearer-token-env-var OPENFF_TOKEN
```

Claude Connectors / ChatGPT custom connector: paste `https://HOST/api/mcp`, leave Client ID & Secret blank, authorize with the bearer token. Grok: `--transport http` against the same URL (bearer via env). Cookie sessions are not accepted — `Authorization: Bearer off_…` only.

## Agent skills

Playbooks for migrate / lineup / book / week live under
`src/lib/agent/skills/` (and are mirrored in `.grok/skills/` for this repo).
Copy or symlink into a host skills dir:

```sh
# Codex:  cp -R src/lib/agent/skills/* ~/.codex/skills/
# Claude: cp -R src/lib/agent/skills/* ~/.claude/skills/
# Grok:   already in .grok/skills/ of this repo; else ~/.grok/skills/
```

## Check

```sh
bun test
bun run typecheck
bun run lint
```
