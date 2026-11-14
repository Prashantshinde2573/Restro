-- Phase 2 (14 Nov 2026). Applied with the Supabase connector; safe to run again.
--
-- 1. patch_order: the team saves only the fields of an order that changed, so two
--    phones editing one order (kitchen marks it ready while a captain adds a dish)
--    no longer wipe each other's change. Runs as the caller: the same row rules and
--    triggers as a normal update apply.
create or replace function public.patch_order(p_rid text, p_id text, p_set jsonb, p_drop text[])
returns boolean
language sql
security invoker
set search_path to ''
as $$
  with u as (
    update public.orders
       set data = (data || coalesce(p_set, '{}'::jsonb)) - coalesce(p_drop, '{}'::text[])
     where rid = p_rid and id = p_id
    returning 1)
  select exists (select 1 from u);
$$;
revoke all on function public.patch_order(text, text, jsonb, text[]) from public, anon;
grant execute on function public.patch_order(text, text, jsonb, text[]) to authenticated;

-- 2. Reports read orders by the day they were made, for any date range.
create index if not exists orders_rid_created on public.orders (rid, (data->>'createdAt'));

-- 3. Error tracking: the app reports crashes and saves that failed.
--    Only the super admin reads them (Admin → App errors).
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  rid text,
  uid uuid,
  role text,
  kind text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb
);
create index if not exists app_errors_at on public.app_errors (at desc);
create index if not exists app_errors_uid_at on public.app_errors (uid, at desc);
alter table public.app_errors enable row level security;
drop policy if exists "super admin reads errors" on public.app_errors;
create policy "super admin reads errors" on public.app_errors for select to authenticated
  using ((select private.is_platform_admin()));
drop policy if exists "super admin clears errors" on public.app_errors;
create policy "super admin clears errors" on public.app_errors for delete to authenticated
  using ((select private.is_platform_admin()));

create or replace function public.log_error(p_rid text, p_kind text, p_message text, p_context jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  role_ text;
begin
  if me is null then return; end if;
  -- at most 30 reports an hour from one sign-in
  if (select count(*) from public.app_errors where uid = me and at > now() - interval '1 hour') >= 30 then return; end if;
  role_ := case when private.is_guest() then 'guest' when p_rid is not null and private.is_owner(p_rid) then 'owner' else 'staff' end;
  insert into public.app_errors (rid, uid, role, kind, message, context)
  values (left(p_rid, 80), me, role_, left(coalesce(p_kind, 'error'), 40), left(coalesce(p_message, ''), 1000),
          case when p_context is null or pg_column_size(p_context) > 4000 then '{}'::jsonb else p_context end);
end $$;
revoke all on function public.log_error(text, text, text, jsonb) from public, anon;
grant execute on function public.log_error(text, text, text, jsonb) to authenticated;
