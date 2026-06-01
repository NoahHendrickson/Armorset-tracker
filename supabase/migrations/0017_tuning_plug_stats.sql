-- Tuning plug investment stats (+10 / -10 etc.) keyed by plug hash.
-- armor_stat_plugs is one row per plug (single boosted stat); tuning plugs
-- need composite (plug_hash, stat) because each variant adjusts two stats.
create table if not exists public.tuning_plug_stats (
  plug_hash bigint not null,
  stat text not null,
  value integer not null,
  primary key (plug_hash, stat)
);

create index if not exists tuning_plug_stats_stat_idx on public.tuning_plug_stats (stat);

alter table public.tuning_plug_stats enable row level security;
