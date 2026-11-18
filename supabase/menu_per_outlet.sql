-- Every outlet has its own menu and categories (applied live as migration menu_per_outlet).
-- Before: dishes without data.outletIds were a "shared menu" for every outlet that had not turned
-- on its own menu; data.offIn held per-outlet sold out.
-- After: each dish and category has data.outletIds = [one outlet].
--   * shared dishes + categories            -> the first outlet (lowest sort)
--   * every other outlet with no dishes yet -> its own copy of the shared dishes (id || '-' || outlet),
--                                              sold out where it was sold out in that outlet
--   * categories used in another outlet     -> a copy for that outlet (id || '-' || outlet)
--   * outlets.data.ownMenu is dropped
-- Backup tables: private.bk_menu_items_20261118, private.bk_categories_20261118, private.bk_outlets_20261118.
create table if not exists private.bk_menu_items_20261118 as select * from public.menu_items;
create table if not exists private.bk_categories_20261118 as select * from public.categories;
create table if not exists private.bk_outlets_20261118 as select * from public.outlets;

do $$
declare
  r record; o record; mainid text; needs_copy boolean;
begin
  for r in select distinct rid from public.outlets loop
    select id into mainid from public.outlets where rid = r.rid
      order by coalesce((data->>'sort')::numeric, 0), id limit 1;

    -- other outlets first, while "shared" is still recognisable
    for o in select id from public.outlets where rid = r.rid and id <> mainid loop
      needs_copy := not exists (select 1 from public.menu_items m where m.rid = r.rid
                                 and jsonb_typeof(m.data->'outletIds') = 'array' and m.data->'outletIds' ? o.id);
      -- category copies for the categories this outlet's dishes will use
      insert into public.categories (rid, id, data)
      select c.rid, c.id || '-' || o.id, c.data || jsonb_build_object('id', c.id || '-' || o.id, 'outletIds', jsonb_build_array(o.id))
        from public.categories c
       where c.rid = r.rid
         and (case when jsonb_typeof(c.data->'outletIds') = 'array' then jsonb_array_length(c.data->'outletIds') else 0 end) = 0
         and exists (select 1 from public.menu_items m where m.rid = r.rid and m.data->>'categoryId' = c.id
                      and ((jsonb_typeof(m.data->'outletIds') = 'array' and m.data->'outletIds' ? o.id)
                           or (needs_copy and (case when jsonb_typeof(m.data->'outletIds') = 'array' then jsonb_array_length(m.data->'outletIds') else 0 end) = 0)))
      on conflict (rid, id) do nothing;
      -- its own dishes move to its own categories
      update public.menu_items m
         set data = m.data || jsonb_build_object('categoryId', (m.data->>'categoryId') || '-' || o.id), updated_at = now()
       where m.rid = r.rid and jsonb_typeof(m.data->'outletIds') = 'array' and m.data->'outletIds' ? o.id
         and exists (select 1 from public.categories c where c.rid = r.rid and c.id = (m.data->>'categoryId') || '-' || o.id);
      -- a copy of the shared menu, if it had none of its own
      if needs_copy then
        insert into public.menu_items (rid, id, data)
        select m.rid, m.id || '-' || o.id,
               (m.data - 'offIn') || jsonb_build_object(
                 'id', m.id || '-' || o.id,
                 'outletIds', jsonb_build_array(o.id),
                 'categoryId', (m.data->>'categoryId') || '-' || o.id,
                 'available', coalesce((m.data->>'available')::boolean, true) and not coalesce(m.data->'offIn' ? o.id, false))
          from public.menu_items m
         where m.rid = r.rid and (case when jsonb_typeof(m.data->'outletIds') = 'array' then jsonb_array_length(m.data->'outletIds') else 0 end) = 0
        on conflict (rid, id) do nothing;
      end if;
    end loop;

    -- shared dishes and categories become the first outlet's
    update public.menu_items m
       set data = (m.data - 'offIn') || jsonb_build_object('outletIds', jsonb_build_array(mainid),
                    'available', coalesce((m.data->>'available')::boolean, true) and not coalesce(m.data->'offIn' ? mainid, false)),
           updated_at = now()
     where m.rid = r.rid and (case when jsonb_typeof(m.data->'outletIds') = 'array' then jsonb_array_length(m.data->'outletIds') else 0 end) = 0;
    update public.categories c
       set data = c.data || jsonb_build_object('outletIds', jsonb_build_array(mainid)), updated_at = now()
     where c.rid = r.rid and (case when jsonb_typeof(c.data->'outletIds') = 'array' then jsonb_array_length(c.data->'outletIds') else 0 end) = 0;
    update public.outlets set data = data - 'ownMenu', updated_at = now() where rid = r.rid and data ? 'ownMenu';
  end loop;
end $$;
