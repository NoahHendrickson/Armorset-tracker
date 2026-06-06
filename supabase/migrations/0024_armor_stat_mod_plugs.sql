-- General / artifice armor stat-mod investment stats keyed by plug hash.
-- armor_stat_plugs is one row per intrinsic armor_stats plug; stat mods need
-- composite (plug_hash, stat) like tuning_plug_stats.
create table if not exists public.armor_stat_mod_plugs (
  plug_hash bigint not null,
  stat text not null,
  value integer not null,
  primary key (plug_hash, stat)
);

create index if not exists armor_stat_mod_plugs_stat_idx
  on public.armor_stat_mod_plugs (stat);

alter table public.armor_stat_mod_plugs enable row level security;
