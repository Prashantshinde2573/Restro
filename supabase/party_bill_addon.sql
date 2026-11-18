-- 19-Nov points 13 and 14.
-- 14: "Yes, we're together" puts the phone on the group: it sees the group's orders and one bill.
--     orders.party_uids lists the guest phones of the group; only the server writes it.
-- 13: a guest's next round goes into the group's open order as an add-on (guest_add_on),
--     checked like a new order; earlier dishes stay as they were.

alter table public.orders add column if not exists party_uids uuid[] not null default '{}';

create or replace function private.ts_or_null(t text) returns timestamptz
language plpgsql stable set search_path to '' as $$
begin
  return t::timestamptz;
exception when others then
  return null;
end $$;

-- the guest phones of one group at a table (who started it, and who joined it)
create or replace function private.party_members(r text, t text, pid text) returns uuid[]
language sql stable security definer set search_path to '' as $$
  select coalesce(array_agg(distinct u), '{}')
    from public.dining_tables d,
         jsonb_array_elements(coalesce(d.data->'parties', '[]'::jsonb)) p,
         lateral (
           select (p->>'guestUid')::uuid as u where coalesce(p->>'guestUid', '') ~ '^[0-9a-f-]{36}$'
           union
           select x::uuid from jsonb_array_elements_text(case when jsonb_typeof(p->'guestUids') = 'array' then p->'guestUids' else '[]'::jsonb end) x
            where x ~ '^[0-9a-f-]{36}$'
         ) m
   where d.rid = r and d.id = t and p->>'id' = coalesce(pid, 'A')
$$;
revoke all on function private.party_members(text, text, text) from public, anon, authenticated;

-- nobody but the server sets party_uids
create or replace function private.keep_party_uids() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if coalesce(current_setting('restropi.party', true), '') = '1' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.party_uids := case when coalesce(new.data->>'tableId', '') <> ''
      then private.party_members(new.rid, new.data->>'tableId', coalesce(new.data->>'partyId', 'A')) else '{}' end;
  else
    new.party_uids := old.party_uids;
  end if;
  return new;
end $$;
create trigger keep_party_uids before insert or update on public.orders
  for each row execute function private.keep_party_uids();

-- guests see and update their own orders, and their group's
alter policy "select (team or guest)" on public.orders using (
  (private.is_guest() and (guest_uid = (select auth.uid()) or (select auth.uid()) = any(party_uids)))
  or (private.is_team(rid) and private.my_outlet(rid, data->>'outletId')));
alter policy "update (team or guest)" on public.orders
  using ((private.is_guest() and (guest_uid = (select auth.uid()) or (select auth.uid()) = any(party_uids)))
         or (private.is_team(rid) and private.my_outlet(rid, data->>'outletId')))
  with check ((private.is_guest() and (guest_uid = (select auth.uid()) or (select auth.uid()) = any(party_uids)))
         or (private.is_team(rid) and private.my_outlet(rid, data->>'outletId')));

-- the online bill (gateway): a phone of the group may pay the group's bill
do $$
declare d text;
begin
  select pg_get_functiondef('public.svc_bill_for(text, text[], uuid)'::regprocedure) into d;
  if position('and guest_uid is distinct from caller)' in d) > 0 then
    d := replace(d, 'and guest_uid is distinct from caller)', 'and guest_uid is distinct from caller and not (caller = any(party_uids)))');
    execute d;
  end if;
end $$;

-- joining a group: guest_set_parties with phoneClaimed on a group that already exists
create or replace function public.guest_set_parties(r text, t text, parties jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  old_parties jsonb;
  tdata jsonb;
  merged jsonb := '[]'::jsonb;
  o jsonb;
  n jsonb;
  cand jsonb;
  g int;
  cap int;
  me text := auth.uid()::text;
  joined text;
  joined_since timestamptz;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not private.is_active(r) then raise exception 'Restaurant is not active'; end if;
  if jsonb_typeof(parties) <> 'array' or jsonb_array_length(parties) > 20 then raise exception 'Bad parties'; end if;

  select data into tdata from public.dining_tables where rid = r and id = t for update;
  if not found then raise exception 'No such table'; end if;
  old_parties := coalesce(tdata->'parties', '[]'::jsonb);

  cap := greatest(1, coalesce(case when (tdata->>'seats') ~ '^\d{1,3}$' then (tdata->>'seats')::int end, 50))
       + coalesce((select sum(case when (j.data->>'seats') ~ '^\d{1,3}$' then (j.data->>'seats')::int else 0 end)
                     from public.dining_tables j where j.rid = r and j.id <> t and j.data->>'joinedTo' = t), 0);

  for o in select * from jsonb_array_elements(old_parties) loop
    select p into n from jsonb_array_elements(parties) p where p->>'id' = o->>'id' limit 1;
    if n is not null then
      g := case when (n->>'guests') ~ '^\d{1,2}$' then (n->>'guests')::int else null end;
      if g between 1 and 50 then
        o := jsonb_set(o, '{guests}', to_jsonb(least(g, greatest(cap, coalesce((o->>'guests')::int, 1)))));
      end if;
      if n->>'status' in ('ordered', 'billing') then o := jsonb_set(o, '{status}', n->'status'); end if;
      if jsonb_typeof(n->'total') = 'number' and (n->>'total')::numeric between 0 and 10000000 then
        o := jsonb_set(o, '{total}', n->'total'); end if;
      if jsonb_typeof(n->'paymentPending') = 'boolean' then o := jsonb_set(o, '{paymentPending}', n->'paymentPending'); end if;
      if (n->>'phoneClaimed') = 'true' then
        o := jsonb_set(o, '{phoneClaimed}', 'true'::jsonb);
        -- this phone is with the group: it shares the group's orders and bill
        if private.is_guest() and coalesce(o->>'guestUid', '') <> me
           and not (case when jsonb_typeof(o->'guestUids') = 'array' then (o->'guestUids') ? me else false end)
           and jsonb_array_length(case when jsonb_typeof(o->'guestUids') = 'array' then o->'guestUids' else '[]'::jsonb end) < 30 then
          o := jsonb_set(o, '{guestUids}', (case when jsonb_typeof(o->'guestUids') = 'array' then o->'guestUids' else '[]'::jsonb end) || to_jsonb(me));
          joined := o->>'id';
          joined_since := private.ts_or_null(o->>'since');
        end if;
      end if;
    end if;
    merged := merged || jsonb_build_array(o);
  end loop;

  for n in select * from jsonb_array_elements(parties) loop
    if not exists (select 1 from jsonb_array_elements(old_parties) x where x->>'id' = n->>'id') then
      if coalesce(n->>'since', '') !~ '^\d{4}-\d{2}-\d{2}T' or (n->>'since')::timestamptz < now() - interval '3 hours' then
        continue;
      end if;
      cand := n;
    end if;
  end loop;
  if cand is not null then
    if coalesce(tdata->>'joinedTo', '') <> '' then
      raise exception 'This table is joined with another table. Please scan that table''s QR.';
    end if;
    n := cand;
    if coalesce(n->>'id', '') !~ '^([A-Z]|P[0-9]{1,2})$' then raise exception 'Bad party id'; end if;
    g := case when (n->>'guests') ~ '^\d{1,2}$' then (n->>'guests')::int else 1 end;
    merged := merged || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id', n->>'id',
      'guests', greatest(1, least(g, cap, 50)),
      'since', now(),
      'status', case when n->>'status' in ('seated', 'ordered') then n->>'status' else 'seated' end,
      'total', case when jsonb_typeof(n->'total') = 'number' then n->'total' else null end,
      'code', case when (n->>'code') ~ '^\d{4}$' then n->>'code' else lpad((floor(random() * 10000))::int::text, 4, '0') end,
      'codeExpiresAt', n->'codeExpiresAt',
      'source', 'qr',
      'phoneClaimed', true,
      'pendingApproval', coalesce((n->>'pendingApproval')::boolean, true),
      'guestUid', auth.uid()
    )));
  end if;

  update public.dining_tables
     set data = jsonb_set(data, '{parties}', merged), updated_at = now()
   where rid = r and id = t;

  -- the group's orders so far (since it sat down) now include this phone
  if joined is not null then
    perform set_config('restropi.party', '1', true);
    update public.orders
       set party_uids = array_append(party_uids, auth.uid())
     where rid = r and data->>'tableId' = t and coalesce(data->>'partyId', 'A') = joined
       and coalesce(data->>'status', '') <> 'cancelled'
       and not (auth.uid() = any(party_uids))
       and coalesce(private.ts_or_null(data->>'createdAt'), now()) >= coalesce(joined_since, now() - interval '6 hours') - interval '10 minutes';
    perform set_config('restropi.party', '', true);
  end if;
end $function$;

-- 13: the next round from a guest's phone joins the group's open order
create or replace function public.guest_add_on(r text, p_order text, p_lines jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  od jsonb; st text; ol jsonb; nl jsonb := '[]'::jsonb; l jsonb; m jsonb; rnd int; nst text; at text;
begin
  if auth.uid() is null or not private.is_guest() then raise exception 'Not allowed'; end if;
  if not private.is_active(r) then raise exception 'Restaurant is not active'; end if;
  select data into od from public.orders
   where rid = r and id = p_order and (guest_uid = auth.uid() or auth.uid() = any(party_uids))
   for update;
  if not found then raise exception 'Order not found'; end if;
  st := od->>'status';
  if st not in ('new', 'accepted', 'preparing', 'ready', 'served') then raise exception 'This order is closed'; end if;
  if jsonb_typeof(od->'payClaim') = 'object' or coalesce(od->>'payPreference', '') <> ''
     or jsonb_typeof(od->'gateway') = 'object'
     or (jsonb_typeof(od->'prepaid') = 'array' and jsonb_array_length(od->'prepaid') > 0) then
    raise exception 'The bill is already asked for';
  end if;
  perform private.check_guest_lines(r, od->>'outletId', p_lines);
  ol := coalesce(od->'lines', '[]'::jsonb);
  if jsonb_array_length(ol) + jsonb_array_length(p_lines) > 60 then raise exception 'Too many dishes in one order. Please ask a staff member.'; end if;
  rnd := 1 + coalesce((select max((x->>'round')::int) from jsonb_array_elements(ol) x where (x->>'round') ~ '^\d{1,3}$'), 1);
  if rnd > 20 then raise exception 'Too many rounds. Please ask a staff member.'; end if;
  -- food already out: the kitchen sees only the new dishes
  if st in ('ready', 'served') then
    select coalesce(jsonb_agg(x || '{"done":true}'::jsonb), '[]'::jsonb) into ol from jsonb_array_elements(ol) x;
  end if;
  at := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  for l in select * from jsonb_array_elements(p_lines) loop
    select data into m from public.menu_items where rid = r and id = l->>'itemId';
    nl := nl || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'itemId', l->>'itemId',
      'name', left(coalesce(nullif(l->>'name', ''), m->>'name', 'Dish'), 120),
      'qty', (l->>'qty')::numeric,
      'price', (l->>'price')::numeric,
      'station', coalesce(m->'station', l->'station'),
      'note', nullif(left(coalesce(l->>'note', ''), 300), ''),
      'round', rnd,
      'addOn', true,
      'addedAt', at)));
  end loop;
  nst := case when st in ('ready', 'served') then 'accepted' else st end;
  perform set_config('restropi.addon', p_order, true);
  update public.orders
     set data = jsonb_set(jsonb_set(data, '{lines}', ol || nl), '{status}', to_jsonb(nst)), updated_at = now()
   where rid = r and id = p_order
  returning data into od;
  perform set_config('restropi.addon', '', true);
  return od;
end $function$;
revoke all on function public.guest_add_on(text, text, jsonb) from public, anon;
grant execute on function public.guest_add_on(text, text, jsonb) to authenticated;
