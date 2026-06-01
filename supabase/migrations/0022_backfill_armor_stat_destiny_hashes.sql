-- Backfill Bungie statTypeHash values for profile ItemStats (component 304) mapping.
-- Stable Armor 3.0 DestinyStatDefinition hashes; safe to apply on every environment.

update public.armor_stat_icons
set destiny_stat_hash = case stat
  when 'Weapons' then 2996146975
  when 'Health' then 392767087
  when 'Class' then 2135857333
  when 'Grenade' then 1735777505
  when 'Melee' then 4244567218
  when 'Super' then 144602215
end
where destiny_stat_hash is null;
