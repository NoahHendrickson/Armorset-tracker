-- Named, shareable dashboard filter presets (distinct from tracker `views` panels).

create table public.saved_filter_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  filters jsonb not null,
  view_mode text not null check (view_mode in ('grid', 'table')),
  share_slug text,
  source_user_id uuid references public.users(id) on delete set null,
  source_display_name text,
  source_share_slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index saved_filter_views_user_id_idx on public.saved_filter_views(user_id);

create unique index saved_filter_views_share_slug_uidx
  on public.saved_filter_views(share_slug)
  where share_slug is not null;

create unique index saved_filter_views_user_source_slug_uidx
  on public.saved_filter_views(user_id, source_share_slug)
  where source_share_slug is not null;

alter table public.saved_filter_views enable row level security;
