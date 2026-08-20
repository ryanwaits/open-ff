-- Wider player-status overlay + RotoWire notes.
--
-- The daily Sleeper map already carries these fields; we used to persist three
-- of them. Notes join on rotowire_id (exact), never a name match.
-- Table is also ensured lazily in player-refresh; CREATE here so a fresh
-- PGLite (Docker volume) can apply this migration before any refresh runs.

create table if not exists ff_player_status (
  player_id text primary key,
  injury_status text,
  status text,
  team text,
  news_updated timestamptz,
  injury_body_part text,
  injury_notes text,
  practice_participation text,
  practice_description text,
  depth_chart_order int,
  rotowire_id text,
  updated_at timestamptz not null default now()
);

alter table ff_player_status add column if not exists news_updated timestamptz;
alter table ff_player_status add column if not exists injury_body_part text;
alter table ff_player_status add column if not exists injury_notes text;
alter table ff_player_status add column if not exists practice_participation text;
alter table ff_player_status add column if not exists practice_description text;
alter table ff_player_status add column if not exists depth_chart_order int;
alter table ff_player_status add column if not exists rotowire_id text;

create index if not exists ff_player_status_rotowire_idx
  on ff_player_status (rotowire_id)
  where rotowire_id is not null;

create table if not exists ff_player_notes (
  id text primary key,
  rotowire_id text not null,
  player_id text,
  headline text not null,
  body text not null,
  dated_at timestamptz not null,
  source text not null default 'RotoWire',
  link text,
  fetched_at timestamptz not null default now()
);

create index if not exists ff_player_notes_player_idx
  on ff_player_notes (player_id, dated_at desc);
