-- Imported season records (rebuild / ESPN / Sleeper snapshots).
alter table ff_rosters add column if not exists snap_wins int;
alter table ff_rosters add column if not exists snap_losses int;
alter table ff_rosters add column if not exists snap_ties int;
alter table ff_rosters add column if not exists snap_pf real;
alter table ff_rosters add column if not exists snap_pa real;
