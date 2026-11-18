
-- Owners may change the logo column (it was missing, so saving a logo failed).
grant update (logo) on public.restaurants to authenticated;
alter table public.restaurants drop constraint if exists restaurants_logo_url;
alter table public.restaurants add constraint restaurants_logo_url
  check (logo is null or (char_length(logo) <= 500 and logo like 'https://rzzhslbotgumhfvkfgvo.supabase.co/storage/v1/object/public/menu-photos/%'));
