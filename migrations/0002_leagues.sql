-- Hosted Ledger leagues. Sleeper is the player/stats pipe only —
-- rosters, drafts, and lineups live here so members never need a Sleeper account.

create table if not exists ff_leagues (
  id text primary key,
  name text not null,
  season text not null,
  invite_code text not null unique,
  commish_id text not null,
  status text not null default 'pre_draft',
  team_count int not null,
  scoring text not null default 'ppr',
  roster_slots text not null,
  playoff_teams int not null default 4,
  current_week int not null default 1,
  locked int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists ff_rosters (
  league_id text not null references ff_leagues(id) on delete cascade,
  roster_id int not null,
  team_name text not null,
  owner_id text,
  primary key (league_id, roster_id)
);

create table if not exists ff_spots (
  league_id text not null,
  roster_id int not null,
  player_id text not null,
  slot text not null default 'bench',
  starter_slot text,
  primary key (league_id, roster_id, player_id)
);

create table if not exists ff_matchups (
  league_id text not null,
  week int not null,
  matchup_id int not null,
  home_roster int not null,
  away_roster int,
  primary key (league_id, week, matchup_id)
);

create table if not exists ff_moves (
  id text primary key,
  league_id text not null,
  week int not null,
  roster_id int not null,
  type text not null,
  add_player_id text,
  drop_player_id text,
  created_at timestamptz not null default now()
);

create table if not exists ff_draft (
  league_id text primary key references ff_leagues(id) on delete cascade,
  status text not null default 'pending',
  pick_no int not null default 1
);

create table if not exists ff_picks (
  league_id text not null,
  pick_no int not null,
  round int not null,
  roster_id int not null,
  player_id text,
  picked_at timestamptz,
  primary key (league_id, pick_no)
);

create index if not exists ff_rosters_owner_idx on ff_rosters (owner_id);
create index if not exists ff_spots_league_player_idx on ff_spots (league_id, player_id);
create index if not exists ff_moves_league_week_idx on ff_moves (league_id, week);
