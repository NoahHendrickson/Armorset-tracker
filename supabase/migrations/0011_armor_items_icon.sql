-- Relative Bungie www path for DestinyInventoryItemDefinition.displayProperties.icon (or highResIcon).
alter table public.armor_items
  add column icon_path text not null default '';
