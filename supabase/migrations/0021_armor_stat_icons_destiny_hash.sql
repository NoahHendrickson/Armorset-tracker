-- Maps Bungie statTypeHash → Armor 3.0 stat name (for profile ItemStats component).
alter table public.armor_stat_icons
  add column if not exists destiny_stat_hash bigint;

create unique index if not exists armor_stat_icons_destiny_stat_hash_uidx
  on public.armor_stat_icons (destiny_stat_hash)
  where destiny_stat_hash is not null;
