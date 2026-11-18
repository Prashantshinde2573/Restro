-- Staff attendance and payroll (Growth plan and up).
--
--   attendance   one row per person per day: id = <memberId>_<YYYY-MM-DD>.
--                Staff ask (status 'pending'); the owner, or someone with the
--                'payroll' permission, approves or rejects it, and can mark a full
--                or half day and overtime hours.
--   staff_pay    one row per person (id = memberId): monthly or per-day pay,
--                overtime rate, weekly off. Kept out of `members` on purpose:
--                every team member can read `members`, but pay is private.
--   pay_entries  advance, bonus, fine and "salary paid" lines for a month.
--
-- Who sees what:
--   * the owner and people with 'payroll': everything in their restaurant.
--   * every other team member: only their own rows.
--   * someone with 'payroll' (not the owner) can't change their OWN pay,
--     approve their OWN days, or add lines for themselves.

create or replace function private.can_payroll(r text)
returns boolean language sql stable security definer set search_path to ''
as $$ select private.has_perm(r, 'payroll') $$;

-- may the signed-in person change pay data of member `m`?
create or replace function private.can_pay_for(r text, m text)
returns boolean language sql stable security definer set search_path to ''
as $$
  select private.is_active(r) and (
    private.is_owner(r)
    or (private.has_perm(r, 'payroll') and m is distinct from private.staff_member()))
$$;

-- is member `m` the signed-in staff member?
create or replace function private.is_me(r text, m text)
returns boolean language sql stable security definer set search_path to ''
as $$ select private.is_team(r) and m is not null and m = private.staff_member() $$;

grant execute on function private.can_payroll(text), private.can_pay_for(text, text), private.is_me(text, text) to anon, authenticated;

create table public.attendance (
  rid text not null references public.restaurants(id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (rid, id)
);
create table public.staff_pay (
  rid text not null references public.restaurants(id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (rid, id)
);
create table public.pay_entries (
  rid text not null references public.restaurants(id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (rid, id)
);
alter table public.attendance enable row level security;
alter table public.staff_pay enable row level security;
alter table public.pay_entries enable row level security;
grant all on public.attendance, public.staff_pay, public.pay_entries to anon, authenticated, service_role;

-- a staff member's own request: their own row, still pending, for a day in the last week (India time)
create or replace function private.own_request_ok(r text, id text, d jsonb)
returns boolean language sql stable security definer set search_path to ''
as $$
  select private.is_me(r, d->>'memberId')
     and d->>'status' = 'pending'
     and id = (d->>'memberId') || '_' || (d->>'date')
     and coalesce(d->>'date', '') ~ '^\d{4}-\d{2}-\d{2}$'
     and (d->>'date')::date between (now() at time zone 'Asia/Kolkata')::date - 7 and (now() at time zone 'Asia/Kolkata')::date
     and coalesce(d->>'kind', '') in ('full', 'half')
     and coalesce((d->>'otHours')::numeric, 0) between 0 and 16
$$;
grant execute on function private.own_request_ok(text, text, jsonb) to anon, authenticated;

-- attendance
create policy "payroll or own reads" on public.attendance for select to authenticated
  using (private.can_payroll(rid) or private.is_me(rid, data->>'memberId'));
create policy "payroll adds, staff ask" on public.attendance for insert to authenticated
  with check (private.can_pay_for(rid, data->>'memberId') or private.own_request_ok(rid, id, data));
create policy "payroll decides, staff change own pending" on public.attendance for update to authenticated
  using (private.can_pay_for(rid, data->>'memberId') or (private.is_me(rid, data->>'memberId') and data->>'status' = 'pending'))
  with check (private.can_pay_for(rid, data->>'memberId') or private.own_request_ok(rid, id, data));
create policy "payroll removes, staff take back pending" on public.attendance for delete to authenticated
  using (private.can_pay_for(rid, data->>'memberId') or (private.is_me(rid, data->>'memberId') and data->>'status' = 'pending'));

-- pay settings
create policy "payroll or own reads" on public.staff_pay for select to authenticated
  using (private.can_payroll(rid) or private.is_me(rid, id));
create policy "payroll adds" on public.staff_pay for insert to authenticated with check (private.can_pay_for(rid, id));
create policy "payroll edits" on public.staff_pay for update to authenticated using (private.can_pay_for(rid, id)) with check (private.can_pay_for(rid, id));
create policy "payroll removes" on public.staff_pay for delete to authenticated using (private.can_pay_for(rid, id));

-- advance, bonus, fine, paid
create policy "payroll or own reads" on public.pay_entries for select to authenticated
  using (private.can_payroll(rid) or private.is_me(rid, data->>'memberId'));
create policy "payroll adds" on public.pay_entries for insert to authenticated with check (private.can_pay_for(rid, data->>'memberId'));
create policy "payroll edits" on public.pay_entries for update to authenticated
  using (private.can_pay_for(rid, data->>'memberId')) with check (private.can_pay_for(rid, data->>'memberId'));
create policy "payroll removes" on public.pay_entries for delete to authenticated using (private.can_pay_for(rid, data->>'memberId'));

create index attendance_rid_updated on public.attendance (rid, updated_at desc);
create index pay_entries_rid_updated on public.pay_entries (rid, updated_at desc);

alter publication supabase_realtime add table public.attendance, public.staff_pay, public.pay_entries;
