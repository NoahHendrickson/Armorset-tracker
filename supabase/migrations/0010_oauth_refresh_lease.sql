-- Short-lived lease so only one invoker refreshes Bungie tokens per user at a time
-- (avoids refresh-token rotation races under concurrent serverless workers).

alter table public.oauth_tokens
  add column if not exists refresh_lease_until timestamptz null;
