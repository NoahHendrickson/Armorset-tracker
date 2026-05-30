-- Exotic armor lookup (item_hash -> slot / class / name / icon).
-- Unlike `armor_items`, exotics have no equipable set, so this is a flat table
-- with no FK to `armor_sets`. It lets the inventory pipeline recognize vault
-- exotics as armor and tag pieces with their rarity + display name/icon.
create table if not exists public.exotic_armor (
  item_hash bigint primary key,
  slot text not null,
  class_type integer not null,
  name text not null,
  icon_path text not null default ''
);
