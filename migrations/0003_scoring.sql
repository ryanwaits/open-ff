-- Configurable scoring books, Sleeper import provenance, locked week results.

alter table ff_leagues add column if not exists scoring_json text;
alter table ff_leagues add column if not exists source text not null default 'ledger';
alter table ff_leagues add column if not exists source_league_id text;

alter table ff_rosters add column if not exists sleeper_owner_id text;
alter table ff_rosters add column if not exists manager_name text;

create table if not exists ff_week_results (
  league_id text not null,
  week int not null,
  roster_id int not null,
  points real not null,
  starters_json text not null default '[]',
  primary key (league_id, week, roster_id)
);

create index if not exists ff_week_results_league_week_idx
  on ff_week_results (league_id, week);
