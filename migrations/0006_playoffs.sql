-- Configurable first-round byes (e.g. 14-team / 7 make it / #1 bye).

alter table ff_leagues add column if not exists playoff_byes int;

update ff_leagues set playoff_byes = case
  when playoff_teams = 7 then 1
  when playoff_teams = 6 then 2
  when playoff_teams = 5 then 1
  else 0 end
where playoff_byes is null;
