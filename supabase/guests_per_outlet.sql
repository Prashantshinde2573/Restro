-- Each outlet keeps its own guest book (applied live as migration guests_per_outlet).
-- A guest-book record is now one outlet + one phone: id = '<10-digit phone>@<outlet id>',
-- data.outletId = the outlet. Visits, spend, points, bills, stamp card and WhatsApp opt-in are per outlet.
-- Older records (id = phone) are split by the outlet of each bill / stamp / reward (bills with no
-- outlet: found through the order number; nothing known: the first outlet). The same bill counted
-- twice before (Claude finds #23) is counted once: visits = bills, spend and points from the bills.
-- Backup: private.bk_guests_20261118.

-- A QR guest adds or touches their record in the outlet they are ordering from.
create or replace function public.guest_touch(r text, rec jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  k text := right(regexp_replace(coalesce(rec->>'id',''), '\D', '', 'g'), 10);
  oid text;
  gid text;
  safe jsonb;
  recent int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if length(k) <> 10 or not private.is_active(r) then return; end if;
  select o.id into oid from public.outlets o where o.rid = r and o.id = rec->>'outletId';
  if oid is null then
    select o.id into oid from public.outlets o where o.rid = r order by coalesce((o.data->>'sort')::numeric, 0), o.id limit 1;
  end if;
  gid := case when oid is null then k else k || '@' || oid end;

  if exists (select 1 from public.guests where rid = r and id = gid) then
    update public.guests
       set data = jsonb_set(data, '{lastVisit}', to_jsonb(now())), updated_at = now()
     where rid = r and id = gid;
    return;
  end if;

  select count(*) into recent from public.guests
   where rid = r and data->>'addedBy' = auth.uid()::text and updated_at > now() - interval '1 day';
  if recent >= 3 then return; end if;

  safe := jsonb_strip_nulls(jsonb_build_object(
    'id', gid, 'outletId', oid, 'name', left(rec->>'name', 60), 'phone', left(rec->>'phone', 20),
    'source', 'qr', 'optIn', coalesce((rec->>'optIn')::boolean, false), 'lastVisit', now(),
    'addedBy', auth.uid()::text));
  insert into public.guests (rid, id, data)
    values (r, gid, safe || '{"visits":0,"spend":0,"points":0,"tier":"New","favourite":"—","verified":false}')
  on conflict (rid, id) do nothing;
end $function$;

-- The guest's own stamp card, in the outlet of their latest order.
create or replace function public.guest_stamps(r text)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  with last as (
    select right(regexp_replace(o.data->>'guestPhone', '\D', '', 'g'), 10) as phone, o.data->>'outletId' as oid
      from public.orders o
     where o.rid = r and o.guest_uid = (select auth.uid()) and coalesce(o.data->>'guestPhone', '') <> ''
     order by o.updated_at desc
     limit 1)
  select coalesce(
    (select jsonb_build_object('stamps', coalesce(g.data->'stamps', '[]'::jsonb), 'rewards', jsonb_array_length(coalesce(g.data->'rewards', '[]'::jsonb)))
       from public.guests g, last
      where g.rid = r and g.id in (last.phone || '@' || coalesce(last.oid, ''), last.phone)
      order by (g.id = last.phone)  -- the outlet's record first
      limit 1),
    jsonb_build_object('stamps', '[]'::jsonb, 'rewards', 0))
  where private.is_guest() and private.is_active(r);
$function$;

create table if not exists private.bk_guests_20261118 as select * from public.guests;

do $$
declare
  g record; mainid text; oid text; bills jsonb; stamps jsonb; rewards jsonb; has_bills boolean; d jsonb;
begin
  for g in select * from public.guests where position('@' in id) = 0 loop
    select id into mainid from public.outlets where rid = g.rid order by coalesce((data->>'sort')::numeric, 0), id limit 1;
    if mainid is null then continue; end if;
    has_bills := jsonb_typeof(g.data->'bills') = 'array' and jsonb_array_length(g.data->'bills') > 0;
    for oid in
      with b as (
        select coalesce(x->>'outletId',
                 (select o.data->>'outletId' from public.orders o where o.rid = g.rid and o.number = (x->>'orderNo')::int limit 1),
                 mainid) as o
          from jsonb_array_elements(case when jsonb_typeof(g.data->'bills') = 'array' then g.data->'bills' else '[]'::jsonb end) x
        union select coalesce(x->>'outletId', mainid) from jsonb_array_elements(case when jsonb_typeof(g.data->'stamps') = 'array' then g.data->'stamps' else '[]'::jsonb end) x
        union select coalesce(x->>'outletId', mainid) from jsonb_array_elements(case when jsonb_typeof(g.data->'rewards') = 'array' then g.data->'rewards' else '[]'::jsonb end) x
        union select mainid where not has_bills)
      select distinct b.o from b where exists (select 1 from public.outlets ot where ot.rid = g.rid and ot.id = b.o)
    loop
      -- this outlet's bills, each bill number once (newest first, as the app keeps them)
      select coalesce(jsonb_agg(x.v order by x.at desc), '[]'::jsonb) into bills from (
        select distinct on (case when coalesce((y->>'orderNo')::numeric, 0) > 0 then y->>'orderNo' else 'x' || md5(y::text) end)
               y || jsonb_build_object('outletId', oid) as v, coalesce(y->>'at', '') as at
          from jsonb_array_elements(case when jsonb_typeof(g.data->'bills') = 'array' then g.data->'bills' else '[]'::jsonb end) y
         where coalesce(y->>'outletId',
                 (select o.data->>'outletId' from public.orders o where o.rid = g.rid and o.number = (y->>'orderNo')::int limit 1),
                 mainid) = oid
         order by (case when coalesce((y->>'orderNo')::numeric, 0) > 0 then y->>'orderNo' else 'x' || md5(y::text) end), coalesce(y->>'at', '') desc) x;
      select coalesce(jsonb_agg(y), '[]'::jsonb) into stamps
        from jsonb_array_elements(case when jsonb_typeof(g.data->'stamps') = 'array' then g.data->'stamps' else '[]'::jsonb end) y
       where coalesce(y->>'outletId', mainid) = oid;
      select coalesce(jsonb_agg(y), '[]'::jsonb) into rewards
        from jsonb_array_elements(case when jsonb_typeof(g.data->'rewards') = 'array' then g.data->'rewards' else '[]'::jsonb end) y
       where coalesce(y->>'outletId', mainid) = oid;
      d := g.data || jsonb_build_object('id', right(g.id, 10) || '@' || oid, 'outletId', oid, 'bills', bills, 'stamps', stamps, 'rewards', rewards);
      if has_bills then
        d := d || jsonb_build_object(
          'visits', jsonb_array_length(bills),
          'spend', (select coalesce(sum((v->>'amount')::numeric), 0) from jsonb_array_elements(bills) v),
          'points', (select coalesce(sum(floor((v->>'amount')::numeric / 10)), 0) from jsonb_array_elements(bills) v),
          'lastVisit', coalesce((select max(v->>'at') from jsonb_array_elements(bills) v where coalesce(v->>'at', '') <> ''), g.data->>'lastVisit'));
      end if;
      insert into public.guests (rid, id, data, updated_at) values (g.rid, right(g.id, 10) || '@' || oid, d, now())
        on conflict (rid, id) do nothing;
    end loop;
    delete from public.guests where rid = g.rid and id = g.id
      and exists (select 1 from public.guests n where n.rid = g.rid and n.id like right(g.id, 10) || '@%');
  end loop;
end $$;
