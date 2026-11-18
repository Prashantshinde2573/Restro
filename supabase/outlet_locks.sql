-- Outlet locks on the server (applied live as migration outlet_locks).
-- The owner sees and changes everything. A sub admin and staff read and change only the rows of
-- the outlets they work in (members.data.outletIds). Rows with no outlet (older data, or a coupon
-- for all outlets) stay open to the team. Menus and categories stay readable to the whole team
-- (guests can read every menu anyway; "Copy from another outlet" needs them) but only an outlet's
-- people change its dishes. Members: a sub admin adds, changes and removes only staff of their own
-- outlets, and can't change their own role or outlets.

create or replace function private.my_outlet(r text, oid text)
 returns boolean language sql stable security definer set search_path to '' as $$
  select private.is_owner(r) or coalesce(oid, '') = '' or private.works_in(r, oid)
$$;

-- any of these outlets is mine (empty / none = every outlet)
create or replace function private.my_outlets(r text, ids jsonb)
 returns boolean language sql stable security definer set search_path to '' as $$
  select private.is_owner(r)
      or jsonb_typeof(ids) is distinct from 'array'
      or jsonb_array_length(ids) = 0
      or exists (select 1 from jsonb_array_elements_text(ids) o where private.works_in(r, o))
$$;

-- every one of these outlets is mine (and there is at least one)
create or replace function private.only_my_outlets(r text, ids jsonb)
 returns boolean language sql stable security definer set search_path to '' as $$
  select private.is_owner(r)
      or (jsonb_typeof(ids) = 'array' and jsonb_array_length(ids) > 0
          and not exists (select 1 from jsonb_array_elements_text(ids) o where not private.works_in(r, o)))
$$;

do $$
declare t text;
begin
  -- one outlet per row: data.outletId
  foreach t in array array['orders', 'dining_tables', 'stock_items', 'guests', 'feedback', 'waiter_calls'] loop
    execute format('drop policy if exists "team reads" on public.%I', t);
    execute format('drop policy if exists "team adds" on public.%I', t);
    execute format('drop policy if exists "team edits" on public.%I', t);
    execute format('drop policy if exists "team removes" on public.%I', t);
    execute format($p$create policy "team reads" on public.%I for select to authenticated using (private.is_team(rid) and private.my_outlet(rid, data->>'outletId'))$p$, t);
    execute format($p$create policy "team adds" on public.%I for insert to authenticated with check (private.is_team(rid) and private.my_outlet(rid, data->>'outletId'))$p$, t);
    execute format($p$create policy "team edits" on public.%I for update to authenticated using (private.is_team(rid) and private.my_outlet(rid, data->>'outletId')) with check (private.is_team(rid) and private.my_outlet(rid, data->>'outletId'))$p$, t);
    execute format($p$create policy "team removes" on public.%I for delete to authenticated using (private.is_team(rid) and private.my_outlet(rid, data->>'outletId'))$p$, t);
  end loop;

  -- menus: the whole team reads; an outlet's people change its dishes and categories
  foreach t in array array['menu_items', 'categories'] loop
    execute format('drop policy if exists "team adds" on public.%I', t);
    execute format('drop policy if exists "team edits" on public.%I', t);
    execute format('drop policy if exists "team removes" on public.%I', t);
    execute format($p$create policy "team adds" on public.%I for insert to authenticated with check (private.is_team(rid) and private.only_my_outlets(rid, data->'outletIds'))$p$, t);
    execute format($p$create policy "team edits" on public.%I for update to authenticated using (private.is_team(rid) and private.only_my_outlets(rid, data->'outletIds')) with check (private.is_team(rid) and private.only_my_outlets(rid, data->'outletIds'))$p$, t);
    execute format($p$create policy "team removes" on public.%I for delete to authenticated using (private.is_team(rid) and private.only_my_outlets(rid, data->'outletIds'))$p$, t);
  end loop;
end $$;

-- coupons: an outlet's coupons for its people; all-outlet coupons readable (and their use counted) by everyone
drop policy if exists "team reads" on public.coupons;
drop policy if exists "team adds" on public.coupons;
drop policy if exists "team edits" on public.coupons;
drop policy if exists "team removes" on public.coupons;
create policy "team reads" on public.coupons for select to authenticated using (private.is_team(rid) and private.my_outlets(rid, data->'outletIds'));
create policy "team adds" on public.coupons for insert to authenticated with check (private.is_team(rid) and private.only_my_outlets(rid, data->'outletIds'));
create policy "team edits" on public.coupons for update to authenticated using (private.is_team(rid) and private.my_outlets(rid, data->'outletIds')) with check (private.is_team(rid) and private.my_outlets(rid, data->'outletIds'));
create policy "team removes" on public.coupons for delete to authenticated using (private.is_team(rid) and private.only_my_outlets(rid, data->'outletIds'));

-- activity of my outlets
drop policy if exists "owner and allowed staff read activity" on public.activity;
create policy "owner and allowed staff read activity" on public.activity for select to authenticated
  using (private.has_perm(rid, 'activity') and private.my_outlet(rid, data->>'outletId'));

-- members: a sub admin manages only staff of their own outlets; nobody but the owner changes their own role or outlets
create or replace function private.guard_member_change()
 returns trigger language plpgsql security definer set search_path to '' as $$
declare me jsonb; myouts jsonb; r text := coalesce(new.rid, old.rid);
begin
  if auth.uid() is null or private.is_owner(r) then return coalesce(new, old); end if;
  select m.data into me from public.members m where m.rid = r and m.id = private.staff_member();
  myouts := coalesce(me->'outletIds', '[]'::jsonb);
  if tg_op in ('UPDATE', 'DELETE') and old.id is distinct from private.staff_member() then
    if coalesce(old.data->>'role', '') <> 'staff' or not (coalesce(old.data->'outletIds', '[]'::jsonb) <@ myouts) then
      raise exception 'You can manage only staff of your own outlets';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.id = private.staff_member() then
    if new.data->>'role' is distinct from old.data->>'role' or new.data->'outletIds' is distinct from old.data->'outletIds'
       or new.data->'perms' is distinct from old.data->'perms' or new.data->'active' is distinct from old.data->'active' then
      raise exception 'Only the owner changes your role, outlets or access';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.id is distinct from private.staff_member() then
    if coalesce(new.data->>'role', '') <> 'staff' or jsonb_array_length(coalesce(new.data->'outletIds', '[]'::jsonb)) = 0
       or not (new.data->'outletIds' <@ myouts) then
      raise exception 'You can add only staff of your own outlets';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists guard_member_change on public.members;
create trigger guard_member_change before insert or update or delete on public.members
  for each row execute function private.guard_member_change();
