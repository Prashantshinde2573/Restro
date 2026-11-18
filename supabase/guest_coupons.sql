-- (outlets: a coupon with data.outletIds works only in those outlets)
drop function if exists public.guest_coupons_on(text);
drop function if exists public.guest_coupon(text, text);
-- Guests use a coupon code on their own bill (QR table ordering).
-- Guests can't read the coupons table, so they check a code with these.
-- Only the code the guest typed is looked up; nothing else about coupons is shown.

-- Does this restaurant have any coupon a guest could use? (shows the "Coupon code" box)
create or replace function public.guest_coupons_on(r text, p_outlet text default null)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private.is_guest() and private.is_active(r) and exists (
    select 1 from public.coupons c
     where c.rid = r
       and coalesce((c.data->>'active')::boolean, false)
       and (coalesce(c.data->>'validTo', '') = '' or c.data->>'validTo' >= to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD'))
       and (p_outlet is null or case when jsonb_typeof(c.data->'outletIds') = 'array' then (jsonb_array_length(c.data->'outletIds') = 0 or (c.data->'outletIds') ? p_outlet) else true end)
  );
$function$;

-- One code: its discount, or why it can't be used.
create or replace function public.guest_coupon(r text, p_code text, p_outlet text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  d jsonb;
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if not (private.is_guest() and private.is_active(r)) then return jsonb_build_object('problem', 'Coupons are not available here'); end if;
  if length(code) < 3 or length(code) > 20 then return jsonb_build_object('problem', 'No coupon with this code'); end if;
  select c.data into d from public.coupons c where c.rid = r and upper(c.data->>'code') = code limit 1;
  if d is null then return jsonb_build_object('problem', 'No coupon with this code'); end if;
  if not coalesce((d->>'active')::boolean, false) then return jsonb_build_object('problem', 'This coupon is turned off'); end if;
  if coalesce(d->>'validTo', '') <> '' and d->>'validTo' < to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD') then
    return jsonb_build_object('problem', 'This coupon has expired');
  end if;
  if p_outlet is not null and not (case when jsonb_typeof(d->'outletIds') = 'array' then (jsonb_array_length(d->'outletIds') = 0 or (d->'outletIds') ? p_outlet) else true end) then
    return jsonb_build_object('problem', 'This coupon is for another outlet');
  end if;
  if coalesce((d->>'maxUses')::numeric, 0) > 0 and coalesce((d->>'uses')::numeric, 0) >= (d->>'maxUses')::numeric then
    return jsonb_build_object('problem', 'This coupon has been used up');
  end if;
  return jsonb_build_object(
    'code', d->>'code',
    'kind', d->>'kind',
    'value', (d->>'value')::numeric,
    'maxOff', (d->>'maxOff')::numeric,
    'minBill', (d->>'minBill')::numeric
  );
end $function$;

revoke all on function public.guest_coupons_on(text, text) from public, anon;
revoke all on function public.guest_coupon(text, text, text) from public, anon;
grant execute on function public.guest_coupons_on(text, text) to authenticated;
grant execute on function public.guest_coupon(text, text, text) to authenticated;
