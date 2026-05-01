-- All pre-canonical fingerprints per equipable set. Saved views may match any element.

alter table public.armor_sets
  add column if not exists legacy_set_hashes bigint[];

update public.armor_sets
set legacy_set_hashes = array[legacy_set_hash]
where legacy_set_hash is not null
  and (legacy_set_hashes is null or cardinality(legacy_set_hashes) = 0);
