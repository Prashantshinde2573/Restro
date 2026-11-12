-- Applied 2026-11-12. A guest sees their own stamp card: the number comes from
-- their own latest order (orders they placed from this phone), never from input.
create or replace function public.guest_stamps(r text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('stamps', coalesce(g.data->'stamps', '[]'::jsonb), 'rewards', jsonb_array_length(coalesce(g.data->'rewards', '[]'::jsonb)))
       from public.guests g
      where g.rid = r
        and g.id = (
          select right(regexp_replace(o.data->>'guestPhone', '\D', '', 'g'), 10)
            from public.orders o
           where o.rid = r and o.guest_uid = (select auth.uid()) and coalesce(o.data->>'guestPhone', '') <> ''
           order by o.updated_at desc
           limit 1)),
    jsonb_build_object('stamps', '[]'::jsonb, 'rewards', 0))
  where private.is_guest() and private.is_active(r);
$$;
revoke all on function public.guest_stamps(text) from public, anon;
grant execute on function public.guest_stamps(text) to authenticated;
