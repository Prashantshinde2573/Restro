# Supabase backend (project: Restro-in, ref rzzhslbotgumhfvkfgvo)

Already applied to the live project — nothing to run here. Kept for the record.

- Database: one row per restaurant in `restaurants`; every other table is
  `(rid, id, data jsonb)` — outlets, members, categories, menu_items,
  dining_tables, orders, guests, feedback. `staff_pins` holds PIN hashes.
- Security: row level security on every table.
  - Owner (email login) and active staff (PIN login) see only their restaurant.
  - Only the owner and sub admins can change outlets and people.
  - Nobody can change the plan or renewal date from the app.
  - Guests (QR page, anonymous login) read the menu side, place and see only their
    own orders, add their own name/phone, leave feedback.
- Order numbers come from a server trigger, so two phones never get the same number.
- Live updates: all tables are in the `supabase_realtime` publication.
- Edge functions: `set-pin` (owner / sub admin sets a staff PIN) and
  `staff-login` (PIN → normal session; 5 wrong tries lock for 5 minutes).

The exact SQL can be downloaded any time with the Supabase CLI:
`supabase link --project-ref rzzhslbotgumhfvkfgvo && supabase db pull`
