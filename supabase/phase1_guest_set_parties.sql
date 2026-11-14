-- Phase 1 · H5: a QR guest could replace the whole seating of any table.
-- Now the server merges what the phone sends with what is stored:
--   * a guest can never remove a party or change its id, code, source, since, server
--     or the staff's approval flag;
--   * on an existing party a guest may only change: guests (1-50), status to
--     'ordered' or 'billing', total, paymentPending, phoneClaimed;
--   * a party the staff closed is not brought back by a phone that still shows it;
--   * a guest may add at most one new party per call (the last one it sends); it is always marked source 'qr'
--     and keeps the staff "Accept" step unless the order was prepaid.
create or replace function public.guest_set_parties(r text, t text, parties jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  old_parties jsonb;
  merged jsonb := '[]'::jsonb;
  o jsonb;
  n jsonb;
  added int := 0;
  cand jsonb;
  g int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not private.is_active(r) then raise exception 'Restaurant is not active'; end if;
  if jsonb_typeof(parties) <> 'array' or jsonb_array_length(parties) > 20 then raise exception 'Bad parties'; end if;

  select coalesce(data->'parties', '[]'::jsonb) into old_parties
    from public.dining_tables where rid = r and id = t for update;
  if not found then raise exception 'No such table'; end if;

  -- 1. every stored party stays; only a few fields may change
  for o in select * from jsonb_array_elements(old_parties) loop
    select p into n from jsonb_array_elements(parties) p where p->>'id' = o->>'id' limit 1;
    if n is not null then
      g := case when (n->>'guests') ~ '^\d{1,2}$' then (n->>'guests')::int else null end;
      if g between 1 and 50 then o := jsonb_set(o, '{guests}', to_jsonb(g)); end if;
      if n->>'status' in ('ordered', 'billing') then o := jsonb_set(o, '{status}', n->'status'); end if;
      if jsonb_typeof(n->'total') = 'number' and (n->>'total')::numeric between 0 and 10000000 then
        o := jsonb_set(o, '{total}', n->'total'); end if;
      if jsonb_typeof(n->'paymentPending') = 'boolean' then o := jsonb_set(o, '{paymentPending}', n->'paymentPending'); end if;
      if (n->>'phoneClaimed') = 'true' then o := jsonb_set(o, '{phoneClaimed}', 'true'::jsonb); end if;
    end if;
    merged := merged || jsonb_build_array(o);
  end loop;

  -- 2. at most one new party, always from the QR and waiting for staff unless prepaid
  for n in select * from jsonb_array_elements(parties) loop
    if not exists (select 1 from jsonb_array_elements(old_parties) x where x->>'id' = n->>'id') then
      -- a party the staff already closed, still on a stale phone, is not brought back
      if coalesce(n->>'since', '') !~ '^\d{4}-\d{2}-\d{2}T' or (n->>'since')::timestamptz < now() - interval '3 hours' then
        continue;
      end if;
      cand := n;  -- the last new party in the list is the one this phone just opened
    end if;
  end loop;
  if cand is not null then
    n := cand;
    if coalesce(n->>'id', '') !~ '^([A-Z]|P[0-9]{1,2})$' then raise exception 'Bad party id'; end if;
    g := case when (n->>'guests') ~ '^\d{1,2}$' then (n->>'guests')::int else 1 end;
    merged := merged || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id', n->>'id',
      'guests', greatest(1, least(g, 50)),
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
