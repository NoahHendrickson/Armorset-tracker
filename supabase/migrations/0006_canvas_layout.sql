-- Per-tracker layout on workspace canvas + persisted camera per user.

alter table public.views
  add column if not exists layout jsonb not null default '{"x":48,"y":48,"w":520,"h":420,"z":0}'::jsonb;

alter table public.users
  add column if not exists workspace_camera jsonb not null default '{"zoom":1,"panX":0,"panY":0}'::jsonb;

-- Stagger existing trackers so they do not all overlap at origin.
with numbered as (
  select
    id,
    row_number() over (partition by user_id order by created_at asc) as rn
  from public.views
)
update public.views v
set layout = jsonb_build_object(
  'x', 48 + (mod(numbered.rn - 1, 4) * 440),
  'y', 48 + (((numbered.rn - 1) / 4) * 460),
  'w', 520,
  'h', 420,
  'z', numbered.rn
)
from numbered
where v.id = numbered.id;
