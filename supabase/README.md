# Supabase backend (project: Restropi-Updated, Mumbai ap-south-1, ref gguwfynlyihsigpcztdp)

Already applied to the live project — nothing to run here. Kept for the record.

## Who signs in
- **Super admin** (the Restropi team): email + password. Listed in `platform_admins`.
  Opens `/admin`: adds restaurants (creates the owner login with a temporary
  password), changes plan and renewal date, suspends, resets owner passwords, deletes.
- **Owner**: email + password made by the super admin. Must set their own password
  on first sign-in. Opens `/app`.
- **Staff**: 4-digit PIN on the restaurant's device (set by the owner or a sub admin).
- **Guests**: no login screen (anonymous sign-in) on the table / counter QR page.

There is no public sign-up.

## Data
- `restaurants`: one row per restaurant, with plan, renewal date and status (active / suspended).
- `outlets, members, categories, menu_items, dining_tables, orders, guests,
  feedback, stock_items`: all `(rid, id, data jsonb)`.
- `staff_pins`: PIN hashes, edge functions only.
- `platform_admins`: super admins, checked on the server only.
- Storage bucket `menu-photos`: dish photos at `<rid>/<file>.jpg`. Anyone can view them;
  only that restaurant's team can upload.

## Security (row level security on every table)
- A restaurant's team sees only its own restaurant, and only while it is active.
- Only the owner and sub admins change outlets and people.
- Plan, renewal date and status change only through the super admin functions.
- Guests can read the menu side, place orders and see only their own,
  add their name and phone, and leave feedback.

## Server functions
- RPC: `whoami`, `admin_restaurants`, `admin_update_restaurant`, `public_staff`, `public_info`,
  `guest_touch`, `guest_set_parties`.
- Edge functions:
  - `admin-restaurants`: create restaurant + owner login, reset owner password, delete.
  - `set-pin`
  - `staff-login`
- Order numbers come from a database trigger, so two phones never get the same number.

Download the exact SQL any time with the Supabase CLI:
`supabase link --project-ref gguwfynlyihsigpcztdp && supabase db pull`

## Two-step login (Google Authenticator)
- `two_step_login.sql` (applied): `private.mfa_ok()`; owner and super admin checks need the code once a phone is set up.
- The app makes the super admin set it up right after the password. Owners turn it on from their profile.
- Edge functions check it too (`mfaOk` in `_shared/common.ts`). Deployed: admin-restaurants, set-pin, gateway-setup.
  `wa-setup` and `wa-send` have the check in this repo but are not redeployed yet (no WhatsApp accounts connected) — deploy them with the next WhatsApp change.
- Lost phone: super admin → restaurant → Access → "Reset two-step login".
