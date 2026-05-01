-- Adds class scoping to views + tables for tracking archetype stat pairs and
-- the per-stat-plug investment values that we use to derive a piece's
-- primary/secondary/tertiary stat at inventory-sync time.

set check_function_bodies = off;

-- ===== views.class_type =====
-- 0 = Titan, 1 = Hunter, 2 = Warlock.
-- Existing rows (created before this migration) get -1 as a tombstone; the
-- view detail UI will prompt the user to recreate them.
alter table public.views
  add column if not exists class_type integer not null default -1;

-- ===== archetype_stat_pairs =====
-- Each Armor 3.0 archetype pre-determines which two of the six stats the
-- piece's "primary" and "secondary" stat plugs roll on. Parsed from the
-- archetype plug's description ("Primary Stat: X | Secondary Stat: Y").
create table if not exists public.archetype_stat_pairs (
  archetype_hash bigint primary key references public.archetypes(archetype_hash) on delete cascade,
  primary_stat text not null,
  secondary_stat text not null
);

-- ===== armor_stat_plugs =====
-- Maps each "armor_stats" plug hash to which of the six stats it boosts and by
-- how much. Used at inventory time to find the +30/+25/+20 stat plugs on a
-- piece and label them primary/secondary/tertiary.
--
-- The manifest has 180 of these (6 stats x 30 magnitudes).
create table if not exists public.armor_stat_plugs (
  plug_hash bigint primary key,
  stat text not null,
  value integer not null
);

create index if not exists armor_stat_plugs_stat_idx on public.armor_stat_plugs (stat);

alter table public.archetype_stat_pairs enable row level security;
alter table public.armor_stat_plugs enable row level security;
