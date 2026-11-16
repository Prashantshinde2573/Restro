-- Staff sign in with their mobile number + PIN on any phone or tablet.
-- The edge function staff-login finds who the number belongs to with this
-- (owner logins never match). Only the service role can call it.
create or replace function public.staff_by_phone(p_digits text)
returns table (rid text, member_id text)
language sql
stable
security definer
set search_path to ''
as $function$
  select m.rid, m.id
    from public.members m
   where length(p_digits) = 10
     and right(regexp_replace(coalesce(m.data->>'phone', ''), '\D', '', 'g'), 10) = p_digits
     and coalesce(m.data->>'role', '') <> 'owner'
     and coalesce((m.data->>'active')::boolean, true)
   limit 5
$function$;
revoke all on function public.staff_by_phone(text) from public, anon, authenticated;
grant execute on function public.staff_by_phone(text) to service_role;
