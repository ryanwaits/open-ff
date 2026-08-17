-- Self-running league ops: FAAB, claims, trades, pick ownership, playoffs.

alter table ff_leagues add column if not exists waiver_type text not null default 'faab';
alter table ff_leagues add column if not exists faab_budget int not null default 100;
alter table ff_leagues add column if not exists waiver_clear_dow int not null default 3;
alter table ff_leagues add column if not exists trade_deadline_week int not null default 11;
alter table ff_leagues add column if not exists playoff_start_week int not null default 15;
alter table ff_leagues add column if not exists regular_weeks int not null default 14;
alter table ff_leagues add column if not exists last_waiver_week int not null default 0;

alter table ff_rosters add column if not exists faab_remaining int;
alter table ff_rosters add column if not exists waiver_order int;

alter table ff_picks add column if not exists original_roster int;

alter table ff_matchups add column if not exists kind text not null default 'regular';
alter table ff_matchups add column if not exists playoff_round int;

alter table ff_moves add column if not exists bid int;

create table if not exists ff_claims (
  id text primary key,
  league_id text not null,
  week int not null,
  roster_id int not null,
  add_player_id text not null,
  drop_player_id text,
  bid int not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists ff_claims_league_week_idx on ff_claims (league_id, week, status);

create table if not exists ff_trades (
  id text primary key,
  league_id text not null,
  week int not null,
  status text not null default 'proposed',
  proposer_roster int not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists ff_trade_sides (
  trade_id text not null references ff_trades(id) on delete cascade,
  roster_id int not null,
  accepted int not null default 0,
  primary key (trade_id, roster_id)
);

create table if not exists ff_trade_assets (
  id text primary key,
  trade_id text not null references ff_trades(id) on delete cascade,
  from_roster int not null,
  to_roster int not null,
  kind text not null,
  player_id text,
  pick_no int
);
