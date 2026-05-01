-- Per-class display icons from DestinyClassDefinition.
-- Filled by manifest sync; one row per Bungie classType (0 Titan, 1 Hunter, 2 Warlock, 3 Unknown).

create table if not exists public.class_icons (
  class_type integer primary key
    constraint class_icons_class_type_check check (class_type between 0 and 3),
  icon_path text not null
);

alter table public.class_icons enable row level security;
