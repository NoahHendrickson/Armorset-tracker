-- Bucket UI icons from DestinyInventoryBucketDefinition (one row per armor slot).
-- Filled by manifest sync from manifest derive output.

create table if not exists public.armor_slot_icons (
  slot text primary key
    constraint armor_slot_icons_slot_check check (
      slot in (
        'helmet',
        'arms',
        'chest',
        'legs',
        'classItem'
      )
    ),
  icon_path text not null
);

alter table public.armor_slot_icons enable row level security;
