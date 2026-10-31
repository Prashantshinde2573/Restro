-- Demo requests from the website form ("Book a free demo").
-- Run once in Supabase → SQL editor. Anyone can send a request; only the super admin can read it.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  phone text not null check (phone ~ '^[0-9+ ]{8,16}$'),
  restaurant text check (restaurant is null or char_length(restaurant) <= 120),
  city text check (city is null or char_length(city) <= 60),
  kind text check (kind is null or char_length(kind) <= 40),
  status text not null default 'new' check (status in ('new','called','won','lost')),
  created_at timestamptz not null default now()
);
alter table public.leads enable row level security;
create policy "website can send a lead" on public.leads for insert to anon, authenticated with check (status = 'new');
create policy "super admin reads leads" on public.leads for select to authenticated using ((select private.is_platform_admin()));
create policy "super admin updates leads" on public.leads for update to authenticated using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
grant insert on public.leads to anon, authenticated;
grant select, update on public.leads to authenticated;
