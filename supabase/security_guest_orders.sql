-- Security: guests (QR, anonymous) can't change prices or items of an order.
-- On insert: every line must be a real, available dish of this restaurant, quantity 1–50,
-- and its price between the dish price and dish price + all its add-ons.
-- On update (guest paying from the phone): items and amounts are kept as they were;
-- the status may only move to "paid".
create or replace function private.guard_guest_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  l jsonb;
  m jsonb;
  base numeric;
  extra numeric;
  q numeric;
  p numeric;
begin
  if not private.is_guest() then
    return new;
  end if;
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
    new.rid := old.rid;
    new.guest_uid := old.guest_uid;
    new.data := jsonb_set(new.data, '{lines}', coalesce(old.data->'lines', '[]'::jsonb));
    if (new.data->>'status') is distinct from (old.data->>'status') and (new.data->>'status') <> 'paid' then
      new.data := jsonb_set(new.data, '{status}', to_jsonb(old.data->>'status'));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_guest_order on public.orders;
create trigger guard_guest_order before insert or update on public.orders
  for each row execute function private.guard_guest_order();
