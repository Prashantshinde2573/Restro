-- Restores the functions exactly as they were before Phase 1 (14 Nov 2026).
create or replace function public.guest_set_parties(r text, t text, parties jsonb)
 returns void language plpgsql security definer set search_path to '' as $function$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not private.is_active(r) then raise exception 'Restaurant is not active'; end if;
  if jsonb_typeof(parties) <> 'array' or jsonb_array_length(parties) > 20 then raise exception 'Bad parties'; end if;
  update public.dining_tables set data = jsonb_set(data, '{parties}', parties), updated_at = now()
    where rid = r and id = t;
end $function$;
create or replace function public.guest_touch(r text, rec jsonb)
 returns void language plpgsql security definer set search_path to '' as $function$
declare
  k text := right(regexp_replace(coalesce(rec->>'id',''), '\D', '', 'g'), 10);
  safe jsonb;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if length(k) <> 10 or not private.is_active(r) then return; end if;
  safe := jsonb_strip_nulls(jsonb_build_object(
    'id', k, 'name', left(rec->>'name', 60), 'phone', left(rec->>'phone', 20),
    'source', 'qr', 'optIn', coalesce((rec->>'optIn')::boolean, false), 'lastVisit', now()));
  insert into public.guests (rid, id, data)
    values (r, k, safe || '{"visits":0,"spend":0,"points":0,"tier":"New","favourite":"—","verified":false}')
  on conflict (rid, id) do update set data = public.guests.data || safe, updated_at = now();
end $function$;
-- staff-login: redeploy the previous version (kept in audit/app/supabase/functions/staff-login/index.ts).
-- The index orders_rid_updated and the function staff_pin_try are harmless to keep.
