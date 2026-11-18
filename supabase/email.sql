-- Email (Resend) support tables. Only the server (service role) touches these; no browser access.

-- 1. Website enquiries can carry an email, so the customer gets a confirmation.
alter table public.leads add column if not exists email text
  check (email is null or (char_length(email) <= 160 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'));

-- 2. Rate limits for emails that anyone can trigger (reset link, sign-in code, enquiry).
--    `key` is a SHA-256 hash of the email / IP, never the address itself.
create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  kind text not null,
  key text not null,
  at timestamptz not null default now()
);
create index if not exists email_log_lookup on public.email_log (kind, key, at desc);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

-- 3. Inbound email webhooks already handled (Resend retries; never forward twice).
create table if not exists public.inbound_events (
  id text primary key,
  email_id text,
  status text not null default 'processing' check (status in ('processing','forwarded','failed')),
  at timestamptz not null default now()
);
alter table public.inbound_events enable row level security;
revoke all on public.inbound_events from anon, authenticated;

-- 4. Does a login exist for this email? (server only: stops "send code" from creating accounts)
create or replace function public.auth_email_exists(e text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where lower(email) = lower(trim(e)) and not coalesce(is_anonymous, false));
$$;
revoke all on function public.auth_email_exists(text) from public, anon, authenticated;
grant execute on function public.auth_email_exists(text) to service_role;

-- Old rows are cleaned up after 30 days.
create or replace function public.email_cleanup() returns void language sql security definer set search_path = '' as $$
  delete from public.email_log where at < now() - interval '30 days';
  delete from public.inbound_events where at < now() - interval '90 days';
$$;
revoke all on function public.email_cleanup() from public, anon, authenticated;
grant execute on function public.email_cleanup() to service_role;
