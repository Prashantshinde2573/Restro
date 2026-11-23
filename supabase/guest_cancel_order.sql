-- A QR guest can cancel their own order until the kitchen starts it.
-- Allowed only while: status is new/accepted, no dish ticked done, no payment started
-- (pay claim, bill asked, gateway, prepaid) and no paid-ahead kitchen stage.
-- The row is locked first, so it can't race the chef pressing "Start".
-- guard_guest_order lets the change through via the same per-order flag guest_add_on uses.
create or replace function public.guest_cancel_order(r text, p_order text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  od jsonb; st text; at text;
begin
  if auth.uid() is null or not private.is_guest() then raise exception 'Not allowed'; end if;
  select data into od from public.orders
   where rid = r and id = p_order and (guest_uid = auth.uid() or auth.uid() = any(party_uids))
   for update;
  if not found then raise exception 'Order not found'; end if;
  st := od->>'status';
  if st not in ('new', 'accepted') then raise exception 'The kitchen has started this order'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(od->'lines', '[]'::jsonb)) x where (x->>'done')::boolean is true) then
    raise exception 'The kitchen has started this order';
  end if;
  if coalesce(od->>'kitchenStatus', '') <> ''
     or jsonb_typeof(od->'payClaim') = 'object' or coalesce(od->>'payPreference', '') <> ''
     or jsonb_typeof(od->'gateway') = 'object'
     or (jsonb_typeof(od->'prepaid') = 'array' and jsonb_array_length(od->'prepaid') > 0)
     or (jsonb_typeof(od->'payments') = 'array' and jsonb_array_length(od->'payments') > 0) then
    raise exception 'A payment is already on this order. Please ask our staff.';
  end if;
  at := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  perform set_config('restropi.addon', p_order, true);
  update public.orders
     set data = data || jsonb_build_object('status', 'cancelled', 'cancelledBy', 'guest', 'cancelledAt', at), updated_at = now()
   where rid = r and id = p_order
  returning data into od;
  perform set_config('restropi.addon', '', true);
  return od;
end $$;

revoke all on function public.guest_cancel_order(text, text) from public, anon;
grant execute on function public.guest_cancel_order(text, text) to authenticated;
