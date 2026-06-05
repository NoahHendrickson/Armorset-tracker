-- Baseline instance IDs for "new drop" diffing + persisted feed snapshots.

create table public.inventory_seen_instances (
  user_id uuid not null references public.users(id) on delete cascade,
  item_instance_id text not null,
  first_seen_at timestamptz not null default now(),
  primary key (user_id, item_instance_id)
);

create index inventory_seen_instances_user_id_idx
  on public.inventory_seen_instances (user_id);

create table public.inventory_drop_feed (
  user_id uuid not null references public.users(id) on delete cascade,
  item_instance_id text not null,
  first_seen_at timestamptz not null default now(),
  piece jsonb not null,
  primary key (user_id, item_instance_id)
);

create index inventory_drop_feed_user_first_seen_idx
  on public.inventory_drop_feed (user_id, first_seen_at desc);

alter table public.inventory_seen_instances enable row level security;
alter table public.inventory_drop_feed enable row level security;
