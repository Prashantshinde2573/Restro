-- 2026-11-13: name, owner and logo are set only by the Restropi team (super admin).
-- 1) the restaurant app no longer writes these columns
revoke update (name, owner, logo) on public.restaurants from authenticated;
-- 2) the super admin list shows the logo
create or replace function public.admin_restaurants()
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
begin
  if not private.is_platform_admin() then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(x order by x->>'createdAt' desc) from (
    select jsonb_build_object(
      'id', r.id, 'name', r.name, 'owner', r.owner, 'ownerEmail', r.owner_email, 'phone', r.phone, 'city', r.city,
      'notes', r.notes, 'plan', r.plan, 'logo', r.logo, 'renewsAt', r.renews_at, 'graceUntil', r.grace_until, 'status', r.status, 'createdAt', r.created_at,
      'outlets', (select count(*) from public.outlets o where o.rid = r.id),
      'members', (select count(*) from public.members m where m.rid = r.id),
      'menuItems', (select count(*) from public.menu_items m where m.rid = r.id),
      'orders30', (select count(*) from public.orders o where o.rid = r.id and o.updated_at > now() - interval '30 days'),
      'lastOrderAt', (select max(o.updated_at) from public.orders o where o.rid = r.id)
    ) x from public.restaurants r) s), '[]'::jsonb);
end $function$;
-- 3) changes by the super admin reach open apps at once
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'restaurants') then
    alter publication supabase_realtime add table public.restaurants;
  end if;
end $$;
