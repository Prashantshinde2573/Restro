-- Two-step login (Google Authenticator / any TOTP app).
--  * Super admin: the app makes them set it up at once; after that every admin check needs the code.
--  * Owner: optional. Once an owner has turned it on (a verified factor), their owner rights
--    need the code too, so a stolen password alone can't open the restaurant.
--  * Staff (PIN / phone) and guests: unchanged — they have no factors.

-- true when this session passed the code, or the person never turned two-step login on
create or replace function private.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;

-- is in the super admin list (no code check): only for whoami, so the app knows to ask for the code
create or replace function private.is_platform_admin_user()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

-- every super admin right goes through this: needs the code once a phone is set up
-- (the app makes the super admin set it up right after the password, so it's always on;
--  checking "set up" here means a hiccup in setting it up can never lock the admin out)
create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid()) and private.mfa_ok()
$$;

create or replace function private.is_owner(r text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from public.restaurants where id = r and owner_uid = auth.uid()) and private.mfa_ok()
$$;

-- whoami: also says whether this session still needs the code
create or replace function public.whoami()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'superAdmin', private.is_platform_admin_user(),
    'restaurant', (select jsonb_build_object('id', id, 'status', status) from public.restaurants where owner_uid = auth.uid() limit 1),
    'aal', coalesce(auth.jwt()->>'aal', 'aal1'),
    'hasFactor', exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'))
$$;

alter policy "owner renames restaurant" on public.restaurants
  using (owner_uid = (select auth.uid()) and (select private.mfa_ok()))
  with check (owner_uid = (select auth.uid()) and (select private.mfa_ok()));
alter policy "team reads restaurant" on public.restaurants
  using ((owner_uid = (select auth.uid()) and (select private.mfa_ok())) or private.is_staff(id) or (private.is_guest() and status = 'active') or private.is_platform_admin());
alter policy "owner or super admin reads plan orders" on public.plan_orders
  using ((select private.is_platform_admin()) or ((select private.mfa_ok()) and exists (select 1 from public.restaurants r where r.id = plan_orders.rid and r.owner_uid = (select auth.uid()))));
