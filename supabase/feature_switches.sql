-- Super admin switches per restaurant: offer "Online payments (own gateway)" and "WhatsApp API"
-- to this client or not. Off by default. Applied live as migration feature_switches.
-- Off means: the option is hidden in the app AND the server refuses it (no "Pay online" for guests,
-- no WhatsApp sending, keys can't be saved). Payments already started still finish, and a guest's
-- STOP is still honoured. Only the super admin changes them (admin_update_restaurant); restaurants
-- has no update grant for signed-in users.

alter table public.restaurants add column if not exists allow_gateway boolean not null default false;
alter table public.restaurants add column if not exists allow_wa_api boolean not null default false;

create or replace function public.admin_update_restaurant(r text, patch jsonb)
 returns void language plpgsql security definer set search_path to '' as $$
begin
  if not private.is_platform_admin() then raise exception 'Not allowed'; end if;
  update public.restaurants set
    plan = coalesce(patch->>'plan', plan),
    renews_at = coalesce((patch->>'renewsAt')::timestamptz, renews_at),
    -- grace: set a date, or send null to take it away; a renewal into the future ends it
    grace_until = case
      when patch ? 'graceUntil' then (patch->>'graceUntil')::timestamptz
      when (patch->>'renewsAt')::timestamptz > now() then null
      else grace_until end,
    status = coalesce(patch->>'status', status),
    name = coalesce(nullif(patch->>'name',''), name),
    owner = coalesce(patch->>'owner', owner),
    phone = coalesce(patch->>'phone', phone),
    city = coalesce(patch->>'city', city),
    notes = coalesce(patch->>'notes', notes),
    allow_gateway = coalesce((patch->>'allowGateway')::boolean, allow_gateway),
    allow_wa_api = coalesce((patch->>'allowWaApi')::boolean, allow_wa_api)
  where id = r;
  if not found then raise exception 'Restaurant not found'; end if;
end $$;

create or replace function public.admin_restaurants()
 returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
  if not private.is_platform_admin() then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(x order by x->>'createdAt' desc) from (
    select jsonb_build_object(
      'id', r.id, 'name', r.name, 'owner', r.owner, 'ownerEmail', r.owner_email, 'phone', r.phone, 'city', r.city,
      'notes', r.notes, 'plan', r.plan, 'logo', r.logo, 'renewsAt', r.renews_at, 'graceUntil', r.grace_until, 'status', r.status, 'createdAt', r.created_at,
      'allowGateway', r.allow_gateway, 'allowWaApi', r.allow_wa_api,
      'gatewayOn', exists (select 1 from public.pay_gateways g where g.rid = r.id and g.active),
      'waOn', exists (select 1 from public.wa_accounts w where w.rid = r.id and w.active),
      'outlets', (select count(*) from public.outlets o where o.rid = r.id),
      'members', (select count(*) from public.members m where m.rid = r.id),
      'menuItems', (select count(*) from public.menu_items m where m.rid = r.id),
      'orders30', (select count(*) from public.orders o where o.rid = r.id and o.updated_at > now() - interval '30 days'),
      'lastOrderAt', (select max(o.updated_at) from public.orders o where o.rid = r.id)
    ) x from public.restaurants r) s), '[]'::jsonb);
end $$;

-- Online payments: only when the super admin allowed it
create or replace function public.gateway_for(r text, p_outlet text)
 returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('provider', g.provider, 'keyId', g.key_id, 'mode', g.mode)
    from public.pay_gateways g join public.restaurants x on x.id = g.rid
   where g.rid = r and g.outlet_id = p_outlet and g.active and x.allow_gateway and private.is_active(r)
     and (private.is_guest() or private.is_team(r))
$$;

-- 'active' is false when not allowed: pay-create refuses new payments; pay-status / pay-webhook
-- still finish payments already started (they don't look at 'active').
create or replace function public.svc_gateway_secrets(r text, p_outlet text)
 returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('provider', g.provider, 'mode', g.mode, 'keyId', g.key_id, 'active', g.active and x.allow_gateway,
           'secret', (select decrypted_secret from vault.decrypted_secrets where id = g.secret_ref),
           'webhook', (select decrypted_secret from vault.decrypted_secrets where id = g.webhook_ref))
    from public.pay_gateways g join public.restaurants x on x.id = g.rid where g.rid = r and g.outlet_id = p_outlet
$$;

-- WhatsApp API: 'active' false when not allowed (wa-send skips, wa-setup refuses); the webhook
-- still records STOP.
create or replace function public.svc_wa_secrets(r text)
 returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('provider', w.provider, 'phoneId', w.phone_number_id, 'wabaId', w.waba_id, 'active', w.active and x.allow_wa_api,
           'settings', w.settings, 'verifyToken', w.verify_token, 'display', w.display_phone,
           'token', (select decrypted_secret from vault.decrypted_secrets where id = w.token_ref),
           'appSecret', (select decrypted_secret from vault.decrypted_secrets where id = w.app_secret_ref))
    from public.wa_accounts w join public.restaurants x on x.id = w.rid where w.rid = r
$$;

create or replace function public.wa_status(r text)
 returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('display', w.display_phone, 'name', w.verified_name,
           'bill', coalesce(w.settings->'bill'->>'template', '') <> '', 'ready', coalesce(w.settings->'ready'->>'template', '') <> '')
    from public.wa_accounts w join public.restaurants x on x.id = w.rid
   where w.rid = r and w.active and x.allow_wa_api and x.plan in ('pro', 'chain') and private.is_team(r)
$$;

-- Saving keys needs the switch on (the edge functions call these with the service role).
create or replace function private.need_switch(r text, what text)
 returns void language plpgsql stable security definer set search_path to '' as $$
begin
  if not exists (select 1 from public.restaurants where id = r and case what when 'gateway' then allow_gateway else allow_wa_api end) then
    raise exception 'Not enabled for this restaurant';
  end if;
end $$;
create or replace function private.guard_gateway_save() returns trigger language plpgsql security definer set search_path to '' as $$
begin perform private.need_switch(new.rid, 'gateway'); return new; end $$;
create or replace function private.guard_wa_save() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.active then perform private.need_switch(new.rid, 'wa'); end if;
  return new;
end $$;
create trigger guard_gateway_save before insert or update on public.pay_gateways
  for each row when (new.active) execute function private.guard_gateway_save();
create trigger guard_wa_save before insert or update on public.wa_accounts
  for each row execute function private.guard_wa_save();
