-- Draft room: a per-pick clock, sticky autodraft, and a pick queue.
-- See plans/007-014 for the features these support.

-- When the pick currently on the clock expires. Null means no clock is
-- running: a draft that has not started, or one the commissioner paused.
alter table ff_draft add column if not exists pick_deadline timestamptz;

-- Per-league pick length. 90s is the locked default (plans/008).
alter table ff_draft add column if not exists pick_seconds int not null default 90;

-- Sticky. Set when a manager's clock expires (plans/009), cleared only by the
-- manager. A roster with this set never starts a clock — it picks immediately.
alter table ff_rosters add column if not exists autodraft int not null default 0;

-- The manager's ranked wish list, which doubles as autodraft order (plans/010).
-- rank is ascending: 1 is taken first.
create table if not exists ff_queue (
  league_id text not null,
  roster_id int not null,
  player_id text not null,
  rank int not null,
  primary key (league_id, roster_id, player_id)
);

create index if not exists ff_queue_order_idx
  on ff_queue (league_id, roster_id, rank);
