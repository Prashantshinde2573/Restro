-- Phase 1 · H3: staff PIN lock-out could be skipped with many tries at once,
-- because the fail count was read first and written later.
-- Now each try takes its slot in ONE atomic step BEFORE the PIN is checked:
--   * 5 wrong tries lock that person for 15 minutes (was 5);
--   * the edge function clears the count only after a correct PIN.
-- Only the service role (edge functions) can call it.
create or replace function public.staff_pin_try(p_rid text, p_member text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  n int;
begin
  update public.staff_pins
     set fails = case when locked_until is not null and locked_until <= now() then 1 else coalesce(fails, 0) + 1 end,
         locked_until = case
           when locked_until is not null and locked_until > now() then locked_until
           when (case when locked_until is not null and locked_until <= now() then 1 else coalesce(fails, 0) + 1 end) >= 5
             then now() + interval '15 minutes'
           else null end
   where rid = p_rid and member_id = p_member
     and (locked_until is null or locked_until <= now())
  returning fails into n;
  if not found then
    if exists (select 1 from public.staff_pins where rid = p_rid and member_id = p_member) then return 'locked'; end if;
    return 'missing';
  end if;
  if n > 5 then return 'locked'; end if;
  return 'ok';
end $function$;
revoke all on function public.staff_pin_try(text, text) from public, anon, authenticated;
grant execute on function public.staff_pin_try(text, text) to service_role;
