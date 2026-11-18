-- Online payments through the restaurant's OWN gateway (Razorpay or Cashfree), per outlet.
-- Applied live as migration payment_gateway.
--
-- Security:
--  * The gateway's secret key and webhook secret live in Supabase Vault (encrypted). The app never
--    reads them: only the edge functions (service role) do, through public.svc_gateway_secrets().
--    Every public.svc_* function can be called by the service role only (not by any signed-in user).
--  * pay_gateways has no write policy: only the edge function gateway-setup (owner only) writes it.
--    The owner reads the row (provider, public key id, last 4 characters, test/live), nobody else.
--  * pay_intents (one per online payment) are written only by the edge functions. The amount is
--    worked out on the server from the orders (public.svc_bill_for), never taken from the phone.
--  * An order becomes paid only by public.svc_gateway_paid(), called by the edge functions after the
--    gateway itself confirmed the payment (signed webhook, or a status fetched from the gateway),
--    for the exact amount, once per payment id.
--  * A QR guest can't set an order's gateway fields (guard_guest_order keeps them).

create table if not exists public.pay_gateways (
  rid text not null,
  outlet_id text not null,
  provider text not null check (provider in ('razorpay', 'cashfree')),
  mode text not null default 'test' check (mode in ('test', 'live')),
  key_id text not null,
  secret_ref uuid not null,
  webhook_ref uuid,
  last4 text,
  active boolean not null default false,
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (rid, outlet_id)
);
alter table public.pay_gateways enable row level security;
create policy "owner reads gateway" on public.pay_gateways for select to authenticated using (private.is_owner(rid));

create table if not exists public.pay_intents (
  id uuid primary key default gen_random_uuid(),
  rid text not null,
  outlet_id text not null,
  provider text not null,
  mode text not null,
  kind text not null check (kind in ('prepay', 'bill')),
  provider_order_id text unique,
  amount_paise integer not null check (amount_paise > 0),
  order_ids text[] not null,
  bill jsonb not null,
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  created_by uuid,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  payment_id text unique,
  method text,
  booked_at timestamptz,
  note text
);
create index if not exists pay_intents_rid_idx on public.pay_intents (rid, created_at desc);
alter table public.pay_intents enable row level security;
create policy "own or outlet team reads" on public.pay_intents for select to authenticated
  using (created_by = (select auth.uid()) or (private.is_team(rid) and private.my_outlet(rid, outlet_id)));

-- Is online payment on for this outlet? (the guest page; public key id only)
create or replace function public.gateway_for(r text, p_outlet text)
 returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('provider', g.provider, 'keyId', g.key_id, 'mode', g.mode)
    from public.pay_gateways g
   where g.rid = r and g.outlet_id = p_outlet and g.active and private.is_active(r)
     and (private.is_guest() or private.is_team(r))
$$;
revoke all on function public.gateway_for(text, text) from public, anon;
grant execute on function public.gateway_for(text, text) to authenticated;

-- The bill of these orders, worked out on the server (same rules as the app):
-- lines → stamp card reward (if asked and the card is full) → coupon (if asked and valid) → GST → round.
create or replace function public.svc_bill_for(r text, ids text[], caller uuid)
 returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  n int; outs int; oid text; sub numeric := 0; o record; od jsonb; prog jsonb; phone text; g jsonb;
  live int; needed int; reward numeric := 0; rname text; code text; c jsonb; coff numeric := 0;
  rate numeric; taxable numeric; gst numeric; total numeric; kinds text[];
begin
  select count(*), count(distinct coalesce(data->>'outletId', '')) into n, outs
    from public.orders where rid = r and id = any(ids);
  if n = 0 or n <> cardinality(ids) then raise exception 'Bill not found'; end if;
  if outs <> 1 then raise exception 'Orders of different outlets'; end if;
  if exists (select 1 from public.orders where rid = r and id = any(ids) and data->>'status' in ('paid', 'cancelled')) then
    raise exception 'This bill is already settled';
  end if;
  if caller is not null and exists (select 1 from public.orders where rid = r and id = any(ids) and guest_uid is distinct from caller) then
    raise exception 'Not your bill';
  end if;
  select data->>'outletId' into oid from public.orders where rid = r and id = any(ids) limit 1;
  select array_agg(distinct case when data->>'status' = 'new' and data->>'payPreference' = 'online' then 'prepay' else 'bill' end)
    into kinds from public.orders where rid = r and id = any(ids);
  if cardinality(kinds) <> 1 then raise exception 'Mixed bill'; end if;

  for o in select data from public.orders where rid = r and id = any(ids) loop
    sub := sub + coalesce((select sum((l->>'qty')::numeric * (l->>'price')::numeric) from jsonb_array_elements(coalesce(o.data->'lines', '[]'::jsonb)) l), 0);
  end loop;
  select data into od from public.outlets where rid = r and id = oid;
  rate := coalesce((od->>'gstRate')::numeric, 0.05);
  if rate < 0 or rate >= 1 then rate := 0.05; end if;
  phone := (select right(regexp_replace(data->>'guestPhone', '\D', '', 'g'), 10) from public.orders where rid = r and id = any(ids) and coalesce(data->>'guestPhone', '') <> '' limit 1);

  -- stamp card reward
  if exists (select 1 from public.orders where rid = r and id = any(ids) and (data->>'wantsReward')::boolean) and phone is not null then
    prog := coalesce(od->'stamps', (select x.data->'stamps' from public.outlets x where x.rid = r and (x.data->'stamps'->>'on')::boolean order by coalesce((x.data->>'sort')::numeric, 0) limit 1));
    if coalesce((prog->>'on')::boolean, false) then
      select data into g from public.guests where rid = r and id in (phone || '@' || oid, phone) order by (id = phone) limit 1;
      needed := coalesce((prog->>'needed')::int, 10);
      select count(*) into live from jsonb_array_elements(coalesce(g->'stamps', '[]'::jsonb)) s
       where coalesce((prog->>'expiryDays')::int, 0) = 0 or (s->>'at')::timestamptz >= now() - make_interval(days => (prog->>'expiryDays')::int);
      if live >= needed then
        reward := case coalesce(prog->>'rewardKind', 'flat')
          when 'item' then coalesce((select (m.data->>'price')::numeric from public.menu_items m where m.rid = r and m.id = prog->>'rewardItemId'), 0)
          when 'flat' then coalesce((prog->>'rewardValue')::numeric, 0)
          else least(coalesce(nullif((prog->>'rewardCap')::numeric, 0), 1e12), round(sub * least(100, coalesce((prog->>'rewardValue')::numeric, 0)) / 100)) end;
        reward := greatest(0, least(sub, round(reward)));
        rname := coalesce(nullif(trim(prog->>'reward'), ''), 'Stamp card reward');
      end if;
    end if;
  end if;

  -- coupon
  code := (select upper(data->>'wantsCoupon') from public.orders where rid = r and id = any(ids) and coalesce(data->>'wantsCoupon', '') <> '' limit 1);
  if code is not null then
    select data into c from public.coupons where rid = r and upper(data->>'code') = code limit 1;
    if c is not null and coalesce((c->>'active')::boolean, false)
       and (coalesce(c->>'validTo', '') = '' or c->>'validTo' >= to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD'))
       and (case when jsonb_typeof(c->'outletIds') = 'array' and jsonb_array_length(c->'outletIds') > 0 then (c->'outletIds') ? oid else true end)
       and not (coalesce((c->>'maxUses')::numeric, 0) > 0 and coalesce((c->>'uses')::numeric, 0) >= (c->>'maxUses')::numeric)
       and not (coalesce((c->>'minBill')::numeric, 0) > 0 and sub < (c->>'minBill')::numeric) then
      coff := case when c->>'kind' = 'percent' then sub * coalesce((c->>'value')::numeric, 0) / 100 else coalesce((c->>'value')::numeric, 0) end;
      if c->>'kind' = 'percent' and coalesce((c->>'maxOff')::numeric, 0) > 0 then coff := least(coff, (c->>'maxOff')::numeric); end if;
      coff := least(greatest(0, sub - reward), greatest(0, least(sub, round(coff))));
    else
      code := null;
    end if;
  end if;

  taxable := greatest(0, sub - reward - coff);
  gst := round(taxable * rate * 100) / 100;
  total := round(taxable + gst);
  return jsonb_strip_nulls(jsonb_build_object(
    'outletId', oid, 'kind', kinds[1], 'subtotal', sub, 'reward', nullif(reward, 0), 'rewardName', case when reward > 0 then rname end,
    'coupon', case when coff > 0 then code end, 'couponOff', nullif(coff, 0), 'gst', gst, 'total', total, 'phone', phone));
end $$;
revoke all on function public.svc_bill_for(text, text[], uuid) from public, anon, authenticated;
grant execute on function public.svc_bill_for(text, text[], uuid) to service_role;

-- Server only: the gateway confirmed a payment. Exact amount, once per payment.
create or replace function public.svc_gateway_paid(p_intent uuid, p_payment_id text, p_method text, p_amount_paise integer)
returns text language plpgsql security definer set search_path = '' as $$
declare i record; ids text[]; n int; k int := 0; each_share numeric; left_over numeric; o record; amt numeric; ts text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  meth text := case when p_method in ('card', 'upi') then p_method else 'upi' end; label text;
begin
  select * into i from public.pay_intents where id = p_intent for update;
  if not found then return 'no intent'; end if;
  if i.status = 'paid' then return 'already'; end if;
  if p_amount_paise <> i.amount_paise then
    update public.pay_intents set status = 'failed', note = 'Amount did not match' where id = p_intent;
    return 'amount mismatch';
  end if;
  update public.pay_intents set status = 'paid', paid_at = now(), payment_id = p_payment_id, method = meth where id = p_intent;
  if exists (select 1 from public.orders where rid = i.rid and id = any(i.order_ids) and data->>'status' in ('paid', 'cancelled')) then
    update public.pay_intents set note = 'Bill was already settled: refund this payment' where id = p_intent;
    return 'already settled';
  end if;
  amt := i.amount_paise / 100.0;
  label := 'Online · ' || initcap(i.provider);
  ids := i.order_ids; n := cardinality(ids);
  left_over := amt;
  for o in select id, data from public.orders where rid = i.rid and id = any(ids) order by id loop
    k := k + 1;
    if k = n then each_share := left_over;
    else
      each_share := round(amt * coalesce((select sum((l->>'qty')::numeric * (l->>'price')::numeric) from jsonb_array_elements(coalesce(o.data->'lines', '[]'::jsonb)) l), 0)
                    / greatest(1, (i.bill->>'subtotal')::numeric));
      left_over := left_over - each_share;
    end if;
    if i.kind = 'prepay' then
      update public.orders set data = (data - 'payClaim') || jsonb_build_object(
          'status', 'accepted', 'payPreference', meth,
          'prepaid', jsonb_build_array(jsonb_build_object('method', meth, 'amount', each_share)),
          'gateway', jsonb_build_object('intent', i.id, 'provider', i.provider, 'paymentId', p_payment_id),
          'paymentLog', coalesce(data->'paymentLog', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', ts, 'by', label, 'text', 'Paid online ₹' || each_share || ' · ' || i.provider || ' ' || p_payment_id))),
        updated_at = now()
       where rid = i.rid and id = o.id;
    else
      update public.orders set data = (data - 'payClaim' - 'prepaid') || jsonb_build_object(
          'status', 'paid', 'payment', meth,
          'payments', jsonb_build_array(jsonb_build_object('method', meth, 'amount', each_share)),
          'confirmedBy', label,
          'gateway', jsonb_build_object('intent', i.id, 'provider', i.provider, 'paymentId', p_payment_id),
          'paymentLog', coalesce(data->'paymentLog', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', ts, 'by', label, 'text', 'Paid online ₹' || each_share || ' · ' || i.provider || ' ' || p_payment_id))),
        updated_at = now()
       where rid = i.rid and id = o.id;
    end if;
  end loop;
  return 'paid';
end $$;
revoke all on function public.svc_gateway_paid(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.svc_gateway_paid(uuid, text, text, integer) to service_role;

-- One staff device does the guest bookkeeping (stamps, coupon, guest bill) for a paid bill.
create or replace function public.claim_gateway_booking(r text, p_intent uuid)
returns boolean language sql security definer set search_path = '' as $$
  with u as (
    update public.pay_intents set booked_at = now()
     where id = p_intent and rid = r and status = 'paid' and booked_at is null and note is null
       and private.is_team(r) and private.my_outlet(r, outlet_id)
    returning 1)
  select exists (select 1 from u)
$$;
revoke all on function public.claim_gateway_booking(text, uuid) from public, anon;
grant execute on function public.claim_gateway_booking(text, uuid) to authenticated;

-- Server only: is this user the owner, or active staff of this outlet?
create or replace function public.svc_is_outlet_team(r text, p_outlet text, p_uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.restaurants where id = r and owner_uid = p_uid)
      or exists (select 1 from public.staff_pins s join public.members m on m.rid = s.rid and m.id = s.member_id
                  where s.rid = r and s.user_id = p_uid and coalesce((m.data->>'active')::boolean, true)
                    and coalesce(m.data->'outletIds', '[]'::jsonb) ? p_outlet)
$$;
revoke all on function public.svc_is_outlet_team(text, text, uuid) from public, anon, authenticated;
grant execute on function public.svc_is_outlet_team(text, text, uuid) to service_role;

-- Secrets in Vault: written and read only by the edge functions.
create or replace function public.svc_save_gateway(r text, p_outlet text, p_provider text, p_mode text, p_key_id text,
                                                 p_secret text, p_webhook text, p_by uuid)
 returns void language plpgsql security definer set search_path to '' as $$
declare old record; s uuid; w uuid; nm text := 'gw_' || r || '_' || p_outlet;
begin
  select * into old from public.pay_gateways where rid = r and outlet_id = p_outlet;
  if found and old.secret_ref is not null then
    perform vault.update_secret(old.secret_ref, p_secret);
    s := old.secret_ref;
  else
    s := vault.create_secret(p_secret, nm || '_' || gen_random_uuid(), 'gateway secret ' || r || '/' || p_outlet);
  end if;
  if p_webhook is not null and p_webhook <> '' then
    if found and old.webhook_ref is not null then
      perform vault.update_secret(old.webhook_ref, p_webhook);
      w := old.webhook_ref;
    else
      w := vault.create_secret(p_webhook, nm || '_wh_' || gen_random_uuid(), 'gateway webhook secret ' || r || '/' || p_outlet);
    end if;
  else
    w := case when found then old.webhook_ref end;
  end if;
  insert into public.pay_gateways (rid, outlet_id, provider, mode, key_id, secret_ref, webhook_ref, last4, active, verified_at, updated_at, updated_by)
  values (r, p_outlet, p_provider, p_mode, p_key_id, s, w, right(p_secret, 4), true, now(), now(), p_by)
  on conflict (rid, outlet_id) do update set provider = excluded.provider, mode = excluded.mode, key_id = excluded.key_id,
    secret_ref = excluded.secret_ref, webhook_ref = excluded.webhook_ref, last4 = excluded.last4, active = true,
    verified_at = now(), updated_at = now(), updated_by = p_by;
end $$;
revoke all on function public.svc_save_gateway(text, text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.svc_save_gateway(text, text, text, text, text, text, text, uuid) to service_role;

create or replace function public.svc_gateway_secrets(r text, p_outlet text)
 returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('provider', g.provider, 'mode', g.mode, 'keyId', g.key_id, 'active', g.active,
           'secret', (select decrypted_secret from vault.decrypted_secrets where id = g.secret_ref),
           'webhook', (select decrypted_secret from vault.decrypted_secrets where id = g.webhook_ref))
    from public.pay_gateways g where g.rid = r and g.outlet_id = p_outlet
$$;
revoke all on function public.svc_gateway_secrets(text, text) from public, anon, authenticated;
grant execute on function public.svc_gateway_secrets(text, text) to service_role;

create or replace function public.svc_gateway_off(r text, p_outlet text)
 returns void language sql security definer set search_path to '' as $$
  update public.pay_gateways set active = false, updated_at = now() where rid = r and outlet_id = p_outlet
$$;
revoke all on function public.svc_gateway_off(text, text) from public, anon, authenticated;
grant execute on function public.svc_gateway_off(text, text) to service_role;

-- A QR guest can't write the gateway fields of an order (only the server does, after the gateway confirmed).
create or replace function private.keep_gateway_fields()
 returns trigger language plpgsql security definer set search_path to '' as $$
begin
  -- only the server (edge functions, no signed-in user) writes it: guests and staff alike keep what is there
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.data := new.data - 'gateway';
  else
    new.data := case when old.data ? 'gateway' then jsonb_set(new.data, '{gateway}', old.data->'gateway') else new.data - 'gateway' end;
  end if;
  return new;
end $$;
create trigger keep_gateway_fields before insert or update on public.orders
  for each row execute function private.keep_gateway_fields();
