-- Stat display icons from DestinyStatDefinition (one row per armor 3.0 stat name).
-- Filled by manifest sync from manifest.armor_stat_icons derive output.

create table if not exists public.armor_stat_icons (
  stat text primary key
    constraint armor_stat_icons_stat_check check (
      stat in (
        'Weapons',
        'Health',
        'Class',
        'Grenade',
        'Melee',
        'Super'
      )
    ),
  icon_path text not null
);

alter table public.armor_stat_icons enable row level security;
