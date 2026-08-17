-- League desk copy. Rules composer writes the first draft; an LLM can
-- replace `source` with 'llm' later using the same context_json.

create table if not exists ff_dispatches (
  id text primary key,
  league_id text not null references ff_leagues(id) on delete cascade,
  week int not null,
  kind text not null default 'recap',
  headline text not null,
  dek text not null,
  body_json text not null default '[]',
  bullets_json text not null default '[]',
  context_json text,
  source text not null default 'rules',
  created_at timestamptz not null default now()
);

create index if not exists ff_dispatches_league_week
  on ff_dispatches (league_id, week, created_at desc);
