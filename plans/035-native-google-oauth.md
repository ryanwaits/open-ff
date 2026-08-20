# Plan 035: Offer Google sign-in on a self-host that has its own client

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to
> the next step. If a STOP fires, report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 9af8eff..HEAD -- src/lib/auth/server.ts src/lib/auth/providers.ts src/lib/auth/email-password.ts src/routes/login.tsx .env.example`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/025-self-host-pickup.md (DONE — broker gated;
  email/password is the self-host path)
- **Category**: dx
- **Planned at**: commit `9af8eff`, 2026-08-19 (reconciled; still no
  `GOOGLE_CLIENT_*`. `.env.example` has an agent-token comment — keep it.)

## Why this matters

Self-host login is email/password only unless you stand up the Grok
auth broker (`GROK_AUTH_CLIENT_ID`). Friends who "just want Google"
cannot. 025 correctly hid the broker buttons off-sandbox so we would
not lie. This plan adds **this app's own** Google client via Better
Auth, optional, env-gated. Preview / broker path stays as-is.

## Current state

- `configuredGrokProviders` (`src/lib/auth/providers.ts:46-48`):
  Google/X buttons only if `GROK_AUTH_CLIENT_ID` or `*.grok-sandbox.com`.
- `emailAndPasswordEnabled = true` (`src/lib/auth/email-password.ts`).
- `src/lib/auth/server.ts` — Better Auth; federates Google/X through
  the broker. **Do not rewrite this file.** Add a small optional
  native Google social provider when `GOOGLE_CLIENT_ID` **and**
  `GOOGLE_CLIENT_SECRET` are set. Keep the broker providers behind
  `configuredGrokProviders`.
- `.env.example` exists from 025 — empty keys only, no secrets.
- Login page already maps `configuredGrokProviders(host)` to buttons.
  `login.tsx` now invalidates `["my-leagues"]` after email sign-in
  (`1abb1b6`) — keep that. Still no `GOOGLE_CLIENT_*`.

Better Auth social `google` is a supported method in this template
**only if** you use the app's own client. Do not add GitHub, magic
links, passkeys, or phone OTP (AGENTS / auth skill: those are
unsupported).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test` | pass |

## Scope

**In scope**:
- `src/lib/auth/server.ts` — **append** optional `google` social when
  both `GOOGLE_CLIENT_*` are set. Do not delete broker wiring.
- `src/lib/auth/providers.ts` or a tiny sibling — login page needs a
  button when native Google is configured (even off-sandbox)
- `src/routes/login.tsx` — show that button; copy must not promise
  Google when neither broker nor native client is set
- `.env.example` — `GOOGLE_CLIENT_ID=` `GOOGLE_CLIENT_SECRET=` empty

**Out of scope**:
- Rewriting `server.ts` / turning off email-password
- X/Twitter native (broker or nothing this plan)
- Magic links, passkeys, OTP
- Changing Better Auth schema (`0001_auth.sql`)

## Git workflow

- Branch: current
- Commit: `feat: optional native Google sign-in for self-host`
- Do NOT push

## Steps

### Step 1: Server

If `process.env.GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are
non-empty, register Better Auth's `google` social provider with those
values. Broker `genericOAuth` entries stay gated as today.

**Verify**: `rg -n "GOOGLE_CLIENT_ID" src/lib/auth/server.ts`.
`rg -n "configuredGrokProviders" src/lib/auth/server.ts` still present.

### Step 2: Login button

A "Google" button appears iff broker **or** native Google is
configured. Off-sandbox with no env: email form only (025 promise).

**Verify**: `rg -n "GOOGLE_CLIENT" src/routes/login.tsx src/lib/auth`.
Read login: no hardcoded "Google and X always work."

### Step 3: Env example

`.env.example` lists the two empty keys. No real secrets.

**Verify**: `rg -n "GOOGLE_CLIENT" .env.example`.

## Done criteria

- [ ] Native Google only when both env vars set
- [ ] Broker / preview path unchanged
- [ ] Email/password still the default self-host path
- [ ] `bun run typecheck` pass
- [ ] No secrets committed

## STOP conditions

- Better Auth's installed google helper does not match the docs you
  find — stop; do not invent an OAuth client
- You would disable email/password to "simplify"
- You are about to add a second social (X native, GitHub)

## Maintenance notes

- Preview should keep using the broker, not the operator's Google
  client, unless they set the env there on purpose.
- Reviewer: reject a login page that shows Google when neither path
  is configured.
