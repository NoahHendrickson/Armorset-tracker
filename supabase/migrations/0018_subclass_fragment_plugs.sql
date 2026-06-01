-- Subclass fragment plugs that modify Armor 3.0 stats (from manifest investmentStats).
create table if not exists public.subclass_fragment_plugs (
  plug_hash bigint primary key,
  name text not null,
  icon_path text not null default ''
);

create table if not exists public.subclass_fragment_plug_stats (
  plug_hash bigint not null,
  stat text not null,
  value integer not null,
  primary key (plug_hash, stat)
);

create index if not exists subclass_fragment_plug_stats_stat_idx
  on public.subclass_fragment_plug_stats (stat);

alter table public.subclass_fragment_plugs enable row level security;
alter table public.subclass_fragment_plug_stats enable row level security;
