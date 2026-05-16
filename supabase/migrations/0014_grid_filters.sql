-- Per-user persisted filter selections for the dashboard Tracker grid.

alter table public.users
  add column if not exists grid_filters jsonb not null
  default '{"version":1,"class":0,"setHashes":[],"archetypeHashes":[],"tuningHashes":[],"tertiaryStats":[],"search":""}'::jsonb;
