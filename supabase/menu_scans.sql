-- Daily limit for reading menu photos with Gemini (edge function menu-from-photo).
-- Run once in Supabase → SQL editor. Until then the function works without a daily limit.
create table if not exists public.menu_scans (
  rid text not null,
  day date not null,
  photos int not null default 0,
  primary key (rid, day)
);
alter table public.menu_scans enable row level security;
-- no policies: only the server function (service role) touches it

-- Add p_n photos for today; returns the new total, or -1 when it would pass p_max.
-- A negative p_n gives photos back (when reading failed).
create or replace function public.menu_scan_take(p_rid text, p_day date, p_n int, p_max int)
returns int language plpgsql security definer set search_path = '' as $$
declare cur int;
begin
  insert into public.menu_scans (rid, day, photos) values (p_rid, p_day, 0) on conflict do nothing;
  select photos into cur from public.menu_scans where rid = p_rid and day = p_day for update;
  if p_n > 0 and cur + p_n > p_max then return -1; end if;
  update public.menu_scans set photos = greatest(0, cur + p_n) where rid = p_rid and day = p_day returning photos into cur;
  return cur;
end $$;
revoke all on function public.menu_scan_take(text, date, int, int) from public, anon, authenticated;
grant execute on function public.menu_scan_take(text, date, int, int) to service_role;
