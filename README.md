# open-ff

A self-hosted fantasy football league desk. Sign in, create a league, invite
friends to **this** origin. One deploy can host many leagues.

## Run it

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

## Public host

Set these before you put it on the internet:

- `BETTER_AUTH_SECRET` — session signing secret
- `BETTER_AUTH_URL` — public https origin (no trailing slash)
- `CRON_SECRET` — required to tick leagues
- `DATABASE_URL` — Postgres; then `bun run db:migrate`

Google and X login only appear when `GROK_AUTH_CLIENT_ID` is set (or on
the Grok live preview). Email/password is the self-host path.

### Tick / cron

The league clock is `GET` (or `POST`) `/api/league/tick`. When
`CRON_SECRET` is set, the request must send that value as
`Authorization: Bearer …` or `?secret=`.

Vercel already schedules `/api/league/tick` via `vercel.json`. Elsewhere,
a cron or systemd timer every 1–5 minutes:

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
public host.

## Players and imports

Sleeper is the player/week pipe (outbound HTTPS). No member needs a
Sleeper account. ESPN cookies are import-only; they are not used at
runtime after import.

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
