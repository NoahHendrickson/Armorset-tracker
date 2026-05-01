-- Maps pre-canonical set fingerprints (djb2 of stripped item names) to equipable set hashes.

alter table public.armor_sets
  add column if not exists legacy_set_hash bigint;

create index if not exists armor_sets_legacy_set_hash_idx
  on public.armor_sets (legacy_set_hash)
  where legacy_set_hash is not null;
