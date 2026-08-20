-- Web Push subscriptions, scoped per user + league. Endpoint is unique per
-- league so one phone can sit in several desks.
create table if not exists ff_push_subs (
  endpoint text not null,
  user_id text not null,
  league_id text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  primary key (endpoint, league_id)
);
create index if not exists ff_push_subs_user_league
  on ff_push_subs (user_id, league_id);
