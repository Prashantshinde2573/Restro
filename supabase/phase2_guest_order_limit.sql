-- Phase 2 (14 Nov 2026): at most 15 QR orders from one phone in 10 minutes.
-- Same function as security_guest_orders.sql, with that one check added.
create or replace function private.guard_guest_order()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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
      if (select count(*) from public.orders o where o.guest_uid = auth.uid() and o.updated_at > now() - interval '10 minutes') >= 15 then
        raise exception 'Too many orders from this phone. Please ask a staff member.';
      end if;
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
end $function$;
