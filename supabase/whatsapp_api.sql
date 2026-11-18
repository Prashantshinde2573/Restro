-- WhatsApp Business API on the restaurant's OWN number (Meta WhatsApp Cloud API first; other
-- providers plug in later behind the same edge functions). Pro plan and up, checked on the server.
-- Applied live as migration whatsapp_api.
--
-- Security:
--  * The access token and the Meta app secret live in Supabase Vault (encrypted). Only the edge
--    functions (service role) read them, through public.svc_wa_secrets(). No browser ever gets them.
--  * Every public.svc_* function can be called by the service role only.
--  * wa_accounts has no write policy: only the edge function wa-setup (owner only, Pro and up) writes it.
--  * wa_messages (the send log) and wa_optouts are written only by the edge functions.
--  * The server decides who gets what: bills and "ready" messages go only to the phone number on that
--    order, offers only to guests of that outlet who said yes to offers and did not send STOP.

create table if not exists public.wa_accounts (
  rid text primary key,
  provider text not null default 'meta' check (provider in ('meta')),
  phone_number_id text not null,
  waba_id text not null,
  display_phone text,
  verified_name text,
  token_ref uuid not null,
  app_secret_ref uuid not null,
  verify_token text not null,               -- typed into Meta's webhook settings; not a secret that unlocks anything
  last4 text,
  active boolean not null default false,
  settings jsonb not null default '{}'::jsonb, -- automatic messages: which approved template for each
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.wa_accounts enable row level security;
create policy "owner reads whatsapp" on public.wa_accounts for select to authenticated using (private.is_owner(rid));

create table if not exists public.wa_messages (
  id uuid primary key default gen_random_uuid(),
  rid text not null,
  outlet_id text,
  kind text not null check (kind in ('bill', 'ready', 'campaign', 'test', 'reply')),
  ref text,                                  -- the order for bill / ready (one message each)
  to_phone text not null,
  template text,
  status text not null default 'sending' check (status in ('sending', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  wa_id text unique,
  error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists wa_messages_once on public.wa_messages (rid, kind, ref) where ref is not null;
create index if not exists wa_messages_rid_idx on public.wa_messages (rid, created_at desc);
create index if not exists wa_messages_phone_idx on public.wa_messages (rid, to_phone, created_at desc);
alter table public.wa_messages enable row level security;
create policy "owner or outlet team reads messages" on public.wa_messages for select to authenticated
  using (private.is_team(rid) and private.my_outlet(rid, outlet_id) and private.has_perm(rid, 'campaigns'));

create table if not exists public.wa_optouts (
  rid text not null,
  phone text not null,
  at timestamptz not null default now(),
  primary key (rid, phone)
);
alter table public.wa_optouts enable row level security;
create policy "owner reads optouts" on public.wa_optouts for select to authenticated using (private.is_owner(rid));

-- Server only: who is calling (owner, or an active member with role, perms and outlets).
create or replace function public.svc_caller(r text, p_uid uuid)
 returns jsonb language sql stable security definer set search_path to '' as $$
  select case
    when exists (select 1 from public.restaurants where id = r and owner_uid = p_uid) then jsonb_build_object('owner', true)
    else (select jsonb_build_object('owner', false, 'memberId', m.id, 'name', m.data->>'name', 'role', m.data->>'role',
                 'perms', coalesce(m.data->'perms', '[]'::jsonb), 'outletIds', coalesce(m.data->'outletIds', '[]'::jsonb))
            from public.staff_pins s join public.members m on m.rid = s.rid and m.id = s.member_id
           where s.rid = r and s.user_id = p_uid and coalesce((m.data->>'active')::boolean, true))
  end
$$;
revoke all on function public.svc_caller(text, uuid) from public, anon, authenticated;
grant execute on function public.svc_caller(text, uuid) to service_role;

create or replace function public.svc_save_wa(r text, p_phone_id text, p_waba_id text, p_display text, p_name text,
                                            p_token text, p_app_secret text, p_by uuid)
 returns text language plpgsql security definer set search_path to '' as $$
declare old record; t uuid; a uuid; vt text;
begin
  select * into old from public.wa_accounts where rid = r;
  if found then
    perform vault.update_secret(old.token_ref, p_token);
    t := old.token_ref;
    if p_app_secret is not null and p_app_secret <> '' then perform vault.update_secret(old.app_secret_ref, p_app_secret); end if;
    a := old.app_secret_ref;
    vt := old.verify_token;
  else
    if p_app_secret is null or p_app_secret = '' then raise exception 'app secret needed'; end if;
    t := vault.create_secret(p_token, 'wa_token_' || r || '_' || gen_random_uuid(), 'WhatsApp token ' || r);
    a := vault.create_secret(p_app_secret, 'wa_app_' || r || '_' || gen_random_uuid(), 'WhatsApp app secret ' || r);
    vt := encode(extensions.gen_random_bytes(18), 'hex');
  end if;
  insert into public.wa_accounts (rid, phone_number_id, waba_id, display_phone, verified_name, token_ref, app_secret_ref, verify_token, last4, active, verified_at, updated_at, updated_by)
  values (r, p_phone_id, p_waba_id, p_display, p_name, t, a, vt, right(p_token, 4), true, now(), now(), p_by)
  on conflict (rid) do update set phone_number_id = excluded.phone_number_id, waba_id = excluded.waba_id, display_phone = excluded.display_phone,
    verified_name = excluded.verified_name, last4 = excluded.last4, active = true, verified_at = now(), updated_at = now(), updated_by = p_by;
  return vt;
end $$;
revoke all on function public.svc_save_wa(text, text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.svc_save_wa(text, text, text, text, text, text, text, uuid) to service_role;

create or replace function public.svc_wa_secrets(r text)
 returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('provider', w.provider, 'phoneId', w.phone_number_id, 'wabaId', w.waba_id, 'active', w.active,
           'settings', w.settings, 'verifyToken', w.verify_token, 'display', w.display_phone,
           'token', (select decrypted_secret from vault.decrypted_secrets where id = w.token_ref),
           'appSecret', (select decrypted_secret from vault.decrypted_secrets where id = w.app_secret_ref))
    from public.wa_accounts w where w.rid = r
$$;
revoke all on function public.svc_wa_secrets(text) from public, anon, authenticated;
grant execute on function public.svc_wa_secrets(text) to service_role;

create or replace function public.svc_wa_off(r text)
 returns void language sql security definer set search_path to '' as $$
  update public.wa_accounts set active = false, updated_at = now() where rid = r
$$;
revoke all on function public.svc_wa_off(text) from public, anon, authenticated;
grant execute on function public.svc_wa_off(text) to service_role;

create or replace function public.svc_wa_settings(r text, p_settings jsonb)
 returns void language sql security definer set search_path to '' as $$
  update public.wa_accounts set settings = p_settings, updated_at = now() where rid = r
$$;
revoke all on function public.svc_wa_settings(text, jsonb) from public, anon, authenticated;
grant execute on function public.svc_wa_settings(text, jsonb) to service_role;

-- A guest wrote STOP (or START): offers stop (or start again) in every outlet of this restaurant.
create or replace function public.svc_wa_optout(r text, p_phone text, p_out boolean)
 returns void language plpgsql security definer set search_path to '' as $$
declare ph text := right(regexp_replace(p_phone, '\D', '', 'g'), 10);
begin
  if length(ph) <> 10 then return; end if;
  if p_out then
    insert into public.wa_optouts (rid, phone) values (r, ph) on conflict do nothing;
    update public.guests set data = data || '{"optIn": false}'::jsonb, updated_at = now()
     where rid = r and (id = ph or id like ph || '@%') and coalesce((data->>'optIn')::boolean, false);
  else
    delete from public.wa_optouts where rid = r and phone = ph;
    -- the guest asked for offers again
    update public.guests set data = data || '{"optIn": true}'::jsonb, updated_at = now()
     where rid = r and (id = ph or id like ph || '@%');
  end if;
end $$;
revoke all on function public.svc_wa_optout(text, text, boolean) from public, anon, authenticated;
grant execute on function public.svc_wa_optout(text, text, boolean) to service_role;

-- The team's app: is WhatsApp API on, and which messages go out by themselves? (no ids, no secrets)
create or replace function public.wa_status(r text)
 returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('display', w.display_phone, 'name', w.verified_name,
           'bill', coalesce(w.settings->'bill'->>'template', '') <> '', 'ready', coalesce(w.settings->'ready'->>'template', '') <> '')
    from public.wa_accounts w join public.restaurants x on x.id = w.rid
   where w.rid = r and w.active and x.plan in ('pro', 'chain') and private.is_team(r)
$$;
revoke all on function public.wa_status(text) from public, anon;
grant execute on function public.wa_status(text) to authenticated;
