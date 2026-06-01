-- Optimizer: subclass scoping for fragments + armor set perk catalog.

alter table public.subclass_fragment_plugs
  add column if not exists subclass_key text not null default 'unknown';

create index if not exists subclass_fragment_plugs_subclass_key_idx
  on public.subclass_fragment_plugs (subclass_key);

create table if not exists public.armor_set_perks (
  set_hash bigint not null references public.armor_sets (set_hash) on delete cascade,
  required_set_count integer not null,
  sandbox_perk_hash bigint not null,
  name text not null,
  description text not null default '',
  icon_path text not null default '',
  primary key (set_hash, sandbox_perk_hash)
);

create index if not exists armor_set_perks_set_hash_idx
  on public.armor_set_perks (set_hash);

alter table public.armor_set_perks enable row level security;
