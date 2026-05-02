-- Bungie.net profile avatar (relative path; prefix with https://www.bungie.net).
alter table public.users
  add column if not exists profile_picture_path text;

comment on column public.users.profile_picture_path is
  'From User.GetMembershipsForCurrentUser bungieNetUser.profilePictureWidePath or profilePicturePath.';
