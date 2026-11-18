-- Phase 1 · H6: app start reads the latest orders of one restaurant.
-- Without this index Postgres scans every order of the restaurant and runs the
-- access rule on each one before sorting (3.8 s on 60k orders in the test copy).
create index if not exists orders_rid_updated
  on public.orders (rid, updated_at desc);
