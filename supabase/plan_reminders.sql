-- Applied 2026-11-13: plan reminders, grace period, and "ended plan = store paused".
alter table public.restaurants add column if not exists grace_until timestamptz;
alter table public.platform_settings
  add column if not exists remind_mode text not null default 'days' check (remind_mode in ('days','daily')),
  add column if not exists remind_days int[] not null default '{15,7,3,1}',
  add column if not exists remind_from int not null default 7 check (remind_from between 1 and 60),
  add column if not exists remind_email boolean not null default true,
  add column if not exists remind_app boolean not null default true;
create table if not exists public.plan_reminders (
  rid text not null references public.restaurants(id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (rid, key)
);
alter table public.plan_reminders enable row level security;
revoke all on public.plan_reminders from anon, authenticated;
-- a restaurant runs while its plan (or grace period) lasts and it isn't suspended
create or replace function private.is_active(r text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.restaurants where id = r and status = 'active'
    and (renews_at > now() or (grace_until is not null and grace_until > now())));
$$;
-- admin_restaurants() now returns graceUntil; admin_update_restaurant() accepts graceUntil (null removes it)
-- and clears the grace when the plan is renewed into the future. See the live definitions in Supabase.

-- Changed 2026-11-13: app reminders every day from `remind_from` days before the end; emails only on
-- `remind_days` (e.g. 10, 3, 1) and once when a grace period starts. remind_mode is no longer used.
alter table public.platform_settings alter column remind_from set default 10, alter column remind_days set default '{10,3,1}';
update public.platform_settings set remind_from = 10, remind_days = '{10,3,1}' where id = 1;
