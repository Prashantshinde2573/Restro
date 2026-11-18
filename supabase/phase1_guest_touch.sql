-- Phase 1 · M1: a QR guest could overwrite any guest's name and WhatsApp opt-in.
-- The phone number is not verified (the QR OTP is not a real SMS), so:
--   * a NEW number is added as before (unverified, source 'qr');
--   * an EXISTING guest only gets a new lastVisit: name, phone and opt-in stay as
--     staff saved them. Staff can still change them in Guests.
--   * one phone (guest session) can add at most 3 numbers per restaurant per day.
create or replace function public.guest_touch(r text, rec jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  k text := right(regexp_replace(coalesce(rec->>'id',''), '\D', '', 'g'), 10);
  safe jsonb;
  recent int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if length(k) <> 10 or not private.is_active(r) then return; end if;

  if exists (select 1 from public.guests where rid = r and id = k) then
    update public.guests
       set data = jsonb_set(data, '{lastVisit}', to_jsonb(now())), updated_at = now()
     where rid = r and id = k;
    return;
  end if;

  select count(*) into recent from public.guests
   where rid = r and data->>'addedBy' = auth.uid()::text and updated_at > now() - interval '1 day';
  if recent >= 3 then return; end if;

  safe := jsonb_strip_nulls(jsonb_build_object(
    'id', k, 'name', left(rec->>'name', 60), 'phone', left(rec->>'phone', 20),
    'source', 'qr', 'optIn', coalesce((rec->>'optIn')::boolean, false), 'lastVisit', now(),
    'addedBy', auth.uid()::text));
  insert into public.guests (rid, id, data)
    values (r, k, safe || '{"visits":0,"spend":0,"points":0,"tier":"New","favourite":"—","verified":false}')
  on conflict (rid, id) do nothing;
end $function$;
