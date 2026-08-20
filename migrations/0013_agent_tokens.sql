-- Personal access tokens for agent hosts (Bearer off_…). Hash at rest; revoke sets revoked_at.
create table if not exists ff_agent_tokens (
  id text primary key,
  user_id text not null,
  name text not null default 'codex',
  prefix text not null,
  hash text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists ff_agent_tokens_hash on ff_agent_tokens (hash)
  where revoked_at is null;
