-- Staff can push tables together for a big group (dining_tables.data.joinedTo = main table id).
-- Guests pick how many they are on the QR: never more than the seats at the table, counting
-- any tables joined to it. A joined table takes no new group of its own (its QR sends guests
-- to the main table). Same checks as phase1_guest_set_parties.sql otherwise.
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
begin
  -- Guests may not remove parties or change their id, code, source, since, server or approval.
  -- On an existing party they may change guests, status (ordered/billing), total, paymentPending, phoneClaimed.
  -- At most one new party per call (the last one sent); always source 'qr'. A party already closed is not brought back.
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not private.is_active(r) then raise exception 'Restaurant is not active'; end if;
  if jsonb_typeof(parties) <> 'array' or jsonb_array_length(parties) > 20 then raise exception 'Bad parties'; end if;

  select data into tdata from public.dining_tables where rid = r and id = t for update;
  if not found then raise exception 'No such table'; end if;
  old_parties := coalesce(tdata->'parties', '[]'::jsonb);

  -- seats here, with the tables joined to this one
  cap := greatest(1, coalesce(case when (tdata->>'seats') ~ '^\d{1,3}$' then (tdata->>'seats')::int end, 50))
       + coalesce((select sum(case when (j.data->>'seats') ~ '^\d{1,3}$' then (j.data->>'seats')::int else 0 end)
                     from public.dining_tables j where j.rid = r and j.id <> t and j.data->>'joinedTo' = t), 0);

  for o in select * from jsonb_array_elements(old_parties) loop
    select p into n from jsonb_array_elements(parties) p where p->>'id' = o->>'id' limit 1;
    if n is not null then
      g := case when (n->>'guests') ~ '^\d{1,2}$' then (n->>'guests')::int else null end;
      -- never above the seats (unless the staff already seated more)
      if g between 1 and 50 then
        o := jsonb_set(o, '{guests}', to_jsonb(least(g, greatest(cap, coalesce((o->>'guests')::int, 1)))));
      end if;
      if n->>'status' in ('ordered', 'billing') then o := jsonb_set(o, '{status}', n->'status'); end if;
      if jsonb_typeof(n->'total') = 'number' and (n->>'total')::numeric between 0 and 10000000 then
        o := jsonb_set(o, '{total}', n->'total'); end if;
      if jsonb_typeof(n->'paymentPending') = 'boolean' then o := jsonb_set(o, '{paymentPending}', n->'paymentPending'); end if;
      if (n->>'phoneClaimed') = 'true' then o := jsonb_set(o, '{phoneClaimed}', 'true'::jsonb); end if;
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
end $function$;
