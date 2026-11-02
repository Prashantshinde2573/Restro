-- Payment confirmation + activity log. Run once in Supabase → SQL editor.
--
-- 1. Bills: only the owner, or a member with "Confirm payments" (confirmPay), can
--    mark an order paid. Everyone else's "paid" is a claim (data.payClaim) that waits
--    for them. Only the owner can mark a paid bill unpaid. Changing how a paid bill
--    was paid needs "Confirm payments" or "Change how a bill was paid".
--    Guests (QR) can't change the status at all: they send a claim.
-- 2. Activity log: table `activity`. Lines are only added, never changed or removed.
--    The owner and members with "Activity log" read it. Who wrote a line is set by
--    the server, so nobody can write in someone else's name.

/* ---------------- helpers ---------------- */
create or replace function private.has_perm(r text, p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active(r) and (private.is_owner(r) or (private.is_staff(r) and exists (
    select 1 from public.members m
    where m.rid = r and m.id = private.staff_member()
      and coalesce(m.data->'perms', '[]'::jsonb) ? p)))
$$;

create or replace function private.can_confirm_pay(r text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_perm(r, 'confirmPay')
$$;

/* ---------------- orders: one guard for guests and the team ---------------- */
create or replace function private.guard_guest_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  l jsonb;
  m jsonb;
  base numeric;
  extra numeric;
  q numeric;
  p numeric;
  was text;
  now_s text;
begin
  -- server-side jobs (service role) are not limited
  if auth.uid() is null then
    return new;
  end if;

  if private.is_guest() then
    if tg_op = 'INSERT' then
      if coalesce(new.data->>'status', 'new') not in ('new', 'accepted') then
        raise exception 'Order must start as new';
      end if;
      if jsonb_array_length(coalesce(new.data->'lines', '[]'::jsonb)) = 0 then
        raise exception 'Empty order';
      end if;
      for l in select * from jsonb_array_elements(new.data->'lines') loop
        select mi.data into m from public.menu_items mi where mi.rid = new.rid and mi.id = l->>'itemId';
        if m is null or coalesce((m->>'available')::boolean, true) = false then
          raise exception 'A dish in this order is not available';
        end if;
        base := coalesce((m->>'price')::numeric, 0);
        select coalesce(sum(coalesce((c->>'price')::numeric, 0)), 0) into extra
          from jsonb_array_elements(coalesce(m->'options', '[]'::jsonb)) g,
               jsonb_array_elements(coalesce(g->'choices', '[]'::jsonb)) c;
        q := (l->>'qty')::numeric;
        p := (l->>'price')::numeric;
        if q is null or q < 1 or q > 50 or q <> trunc(q) then
          raise exception 'Wrong quantity';
        end if;
        if p is null or p < base or p > base + extra then
          raise exception 'Prices changed. Please reload the menu.';
        end if;
      end loop;
    else
      -- a guest may ask for the bill or say "I've paid" (a claim); the lines,
      -- status and recorded payments stay as they were
      new.rid := old.rid;
      new.guest_uid := old.guest_uid;
      new.data := jsonb_set(new.data, '{lines}', coalesce(old.data->'lines', '[]'::jsonb));
      new.data := jsonb_set(new.data, '{status}', coalesce(old.data->'status', '"new"'::jsonb));
      new.data := jsonb_set(new.data, '{payments}', coalesce(old.data->'payments', 'null'::jsonb));
    end if;
    return new;
  end if;

  -- the team
  now_s := new.data->>'status';
  if tg_op = 'INSERT' then
    if now_s = 'paid' and not private.can_confirm_pay(new.rid) then
      raise exception 'This bill needs the owner''s confirmation';
    end if;
    return new;
  end if;
  was := old.data->>'status';
  if now_s = 'paid' and coalesce(was, '') <> 'paid' and not private.can_confirm_pay(new.rid) then
    raise exception 'This bill needs the owner''s confirmation';
  end if;
  if was = 'paid' and coalesce(now_s, '') <> 'paid' and not private.is_owner(new.rid) then
    raise exception 'Only the owner can mark a paid bill unpaid';
  end if;
  if was = 'paid' and now_s = 'paid'
     and (new.data->'payments') is distinct from (old.data->'payments')
     and not (private.can_confirm_pay(new.rid) or private.has_perm(new.rid, 'editPayment')) then
    raise exception 'You can''t change how this bill was paid';
  end if;
  return new;
end $$;

drop trigger if exists guard_guest_order on public.orders;
create trigger guard_guest_order before insert or update on public.orders
  for each row execute function private.guard_guest_order();

/* ---------------- activity log ---------------- */
create table if not exists public.activity (
  rid text not null references public.restaurants(id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (rid, id)
);
create index if not exists activity_rid_time on public.activity (rid, updated_at desc);
alter table public.activity enable row level security;

drop policy if exists "owner and allowed staff read activity" on public.activity;
create policy "owner and allowed staff read activity" on public.activity
  for select to authenticated using (private.has_perm(rid, 'activity'));

drop policy if exists "team adds activity" on public.activity;
create policy "team adds activity" on public.activity
  for insert to authenticated with check (
    (private.is_team(rid) and data->>'source' = 'team')
    or (private.is_guest() and private.is_active(rid) and data->>'source' = 'guest')
  );
-- no update or delete policies: the log can't be edited

-- who and when are set by the server
create or replace function private.stamp_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  who text;
begin
  if private.is_guest() then
    who := 'Guest (QR)';
  elsif private.is_owner(new.rid) then
    select coalesce(nullif(r.owner, ''), 'Owner') || ' (Owner)' into who from public.restaurants r where r.id = new.rid;
  else
    select m.data->>'name' into who from public.members m where m.rid = new.rid and m.id = private.staff_member();
  end if;
  new.data := jsonb_set(new.data, '{by}', to_jsonb(coalesce(who, 'Staff')));
  new.data := jsonb_set(new.data, '{at}', to_jsonb(to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  new.data := jsonb_set(new.data, '{text}', to_jsonb(left(coalesce(new.data->>'text', ''), 400)));
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists stamp_activity on public.activity;
create trigger stamp_activity before insert on public.activity
  for each row execute function private.stamp_activity();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity') then
    alter publication supabase_realtime add table public.activity;
  end if;
end $$;
