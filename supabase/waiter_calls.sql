-- Waiter calls: a guest taps "Call a waiter"; staff take it or the owner assigns it.
-- (Applied to the project on 2026-11-07.)
create table public.waiter_calls (
  rid text not null references public.restaurants(id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  guest_uid uuid,
  primary key (rid, id)
);
create index waiter_calls_guest_uid_idx on public.waiter_calls (guest_uid);
create index waiter_calls_recent_idx on public.waiter_calls (rid, updated_at desc);
alter table public.waiter_calls enable row level security;

create policy "team reads" on public.waiter_calls for select to authenticated using (private.is_team(rid));
create policy "team adds" on public.waiter_calls for insert to authenticated with check (private.is_team(rid));
create policy "team edits" on public.waiter_calls for update to authenticated using (private.is_team(rid)) with check (private.is_team(rid));
create policy "team removes" on public.waiter_calls for delete to authenticated using (private.is_team(rid));
create policy "guests read own calls" on public.waiter_calls for select to authenticated
  using (private.is_guest() and guest_uid = (select auth.uid()));
create policy "guests call a waiter" on public.waiter_calls for insert to authenticated
  with check (private.is_guest() and guest_uid = (select auth.uid()) and private.is_active(rid) and data->>'status' = 'open' and not (data ? 'to'));
create policy "guests cancel own calls" on public.waiter_calls for update to authenticated
  using (private.is_guest() and guest_uid = (select auth.uid()) and data->>'status' = 'open')
  with check (private.is_guest() and guest_uid = (select auth.uid()) and data->>'status' in ('open', 'cancelled') and not (data ? 'to'));

create or replace function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger touch_waiter_calls before update on public.waiter_calls for each row execute function private.touch_updated_at();

alter publication supabase_realtime add table public.waiter_calls;
