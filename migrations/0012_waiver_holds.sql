-- A player cut after (or during) a waiver run sits here until the next run,
-- so he is not a free agent the moment he leaves a roster.
create table if not exists ff_waiver_holds (
  league_id text not null,
  player_id text not null,
  primary key (league_id, player_id)
);
