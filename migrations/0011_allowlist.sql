-- Invite-only: optional email allowlist per league.
-- Empty list = join/claim by invite code only (legacy). Nonempty = email must match.

create table if not exists ff_allowlist (
  league_id text not null,
  email text not null,
  primary key (league_id, email)
);
