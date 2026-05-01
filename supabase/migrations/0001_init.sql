-- Armor Set Checklist — initial schema
-- Apply with: supabase db push  (after `supabase link --project-ref <ref>`)

set check_function_bodies = off;

create extension if not exists "pgcrypto" with schema "public";

-- ===== Users =====
-- One row per authenticated Bungie identity
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  bungie_membership_id text not null unique,
  bungie_membership_type integer not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== OAuth tokens (encrypted by app, not by Postgres) =====
create table if not exists public.oauth_tokens (
  user_id uuid primary key references public.users(id) on delete cascade,
  access_token_encrypted bytea not null,
  refresh_token_encrypted bytea not null,
  expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- ===== Saved views =====
create table if not exists public.views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  set_hash bigint not null,
  archetype_hash bigint not null,
  tuning_hash bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists views_user_id_idx on public.views (user_id);

-- ===== Inventory cache =====
-- Snapshot of a user's full armor inventory after a successful Bungie sync.
-- `items` is a normalized array of derived armor pieces produced by the
-- inventory sync route. Cached for ~5 min before re-fetching.
create table if not exists public.inventory_cache (
  user_id uuid primary key references public.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now()
);

-- ===== Manifest version tracking =====
create table if not exists public.manifest_versions (
  version text primary key,
  fetched_at timestamptz not null default now(),
  is_active boolean not null default false
);

-- ===== Manifest-derived lookup tables =====
-- Rebuilt by the manifest sync job whenever the Bungie manifest version changes.

create table if not exists public.armor_sets (
  set_hash bigint primary key,
  name text not null,
  season_id integer
);

-- Per-armor-item rollup: maps an instance's itemHash to its set + slot.
-- Built from the manifest at sync time. Used by inventory sync to compute
-- (set_hash, slot) without rehydrating the full DestinyInventoryItemDefinition.
create table if not exists public.armor_items (
  item_hash bigint primary key,
  set_hash bigint not null references public.armor_sets(set_hash) on delete cascade,
  slot text not null check (slot in ('helmet', 'arms', 'chest', 'legs', 'classItem')),
  class_type integer not null
);

create index if not exists armor_items_set_hash_idx on public.armor_items (set_hash);

create table if not exists public.archetypes (
  archetype_hash bigint primary key,
  name text not null
);

create table if not exists public.tunings (
  tuning_hash bigint primary key,
  name text not null
);

create table if not exists public.plug_to_archetype (
  plug_hash bigint primary key,
  archetype_hash bigint not null references public.archetypes(archetype_hash) on delete cascade
);

create table if not exists public.plug_to_tuning (
  plug_hash bigint primary key,
  tuning_hash bigint not null references public.tunings(tuning_hash) on delete cascade
);

-- ===== Row-level security =====
-- All tables are accessed exclusively via the server using the service-role key,
-- so RLS is enabled with no permissive policies. Anon/auth keys cannot read.

alter table public.users enable row level security;
alter table public.oauth_tokens enable row level security;
alter table public.views enable row level security;
alter table public.inventory_cache enable row level security;
alter table public.manifest_versions enable row level security;
alter table public.armor_sets enable row level security;
alter table public.armor_items enable row level security;
alter table public.archetypes enable row level security;
alter table public.tunings enable row level security;
alter table public.plug_to_archetype enable row level security;
alter table public.plug_to_tuning enable row level security;

-- ===== Updated-at triggers =====
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at
  before update on public.users
  for each row execute function public.touch_updated_at();

drop trigger if exists views_touch_updated_at on public.views;
create trigger views_touch_updated_at
  before update on public.views
  for each row execute function public.touch_updated_at();

drop trigger if exists oauth_tokens_touch_updated_at on public.oauth_tokens;
create trigger oauth_tokens_touch_updated_at
  before update on public.oauth_tokens
  for each row execute function public.touch_updated_at();
