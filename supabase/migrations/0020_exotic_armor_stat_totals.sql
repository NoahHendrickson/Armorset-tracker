-- Manifest-derived default stat totals for exotic armor (no Armor 3.0 intrinsic plugs).
alter table public.exotic_armor
  add column if not exists stat_totals jsonb;
