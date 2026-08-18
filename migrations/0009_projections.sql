-- Weekly projections, stored as raw component stats so they can be scored
-- under each league's own book (see plans/015).
create table if not exists ff_projections (
  season text not null,
  week int not null,
  player_id text not null,
  stats_json text not null,
  updated_at timestamptz not null default now(),
  primary key (season, week, player_id)
);
