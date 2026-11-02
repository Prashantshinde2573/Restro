# Restropi security review

Date: 2 Nov 2026. Scope: the website, the app (/app, /admin, guest QR pages), Supabase database rules (RLS), database functions and edge functions.

Status words: **Fixed** (done in code / database), **Needs you** (a switch or SQL you have to run), **Open** (to decide or build later).

## Summary

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Guests (QR) could change dish prices or items in an order they send | High | Needs you: run `supabase/security_guest_orders.sql` |
| 2 | A guest can mark their own bill "paid by UPI" from the phone; staff don't confirm the money arrived | High (business) | Open: decide if UPI from the phone needs staff confirmation |
| 3 | Menu photo reading (Gemini) has no daily limit until the SQL is run, so it could be used to run up your Gemini bill | Medium | Needs you: run `supabase/menu_scans.sql` |
| 4 | Leaked-password protection is off in Supabase Auth | Medium | Needs you: Supabase → Authentication → Settings → turn on "Leaked password protection" |
| 5 | No security headers (clickjacking, sniffing, referrer) | Medium | Fixed (`next.config.ts`) |
| 6 | Staff PIN: 5 wrong tries lock that person for 5 minutes. A 4-digit PIN can still be guessed over several days | Medium | Open: longer lock after repeated locks, or 6-digit PINs |
| 7 | Super admin changes to a client (plan, renewal, suspend, password reset) happened in one tap | Medium | Fixed: every change now asks for the super admin password |
| 8 | Staff names of a restaurant are public through `public_staff` (for the PIN screen) | Low | Accepted (needed for the PIN screen). Restaurant ids are random. |
| 9 | Content-Security-Policy header | Low | Open: add once Google Analytics / Tag Manager ids are final |

## What was checked

- **Row level security** on every table: owner and staff only see their own restaurant (`private.is_team`), guests only read the menu, tables and their own orders, the super admin only through checked functions. Policies were reviewed table by table; nothing reads across restaurants.
- **Edge functions** (`staff-login`, `set-pin`, `admin-restaurants`, `menu-from-photo`): each checks the signed-in person and their role itself. Secrets (service key, Gemini key) stay on the server.
- **Database functions**: `security definer` functions set `search_path` and check the caller (`is_platform_admin`, `is_team`, …). `admin_sales` (new) returns data only to the super admin.
- **Input handling**: React escapes text on screen; the printed bill, PDF report and PDF bill escape or strip special characters; no user HTML is rendered.
- **Passwords**: Supabase Auth (hashed, rate-limited); staff PINs are PBKDF2-hashed on the server with lockout.
- **Payments**: UPI QR is generated in the browser for the restaurant's own UPI id; no card data is handled by Restropi.

## Details and fixes

### 1. Guest order tampering (High)
A guest's phone talks to the database directly. A technical user could send an order with a lower price (₹1 Biryani) or change items after sending. `supabase/security_guest_orders.sql` adds a database check: every line must be a real, available dish of that restaurant, quantity 1–50, price between the dish price and dish price + its add-ons; after sending, guests can't change items or amounts, and can only move the status to "paid". **Run it once in Supabase → SQL editor.** I tried to apply it from here, but the approval question timed out.

### 2. "Paid by UPI" from the guest's phone (High, business)
Today the guest taps "I've paid" and the bill closes. Nothing checks the money arrived. Options: (a) keep as is and ask cashiers to check the UPI app; (b) UPI from the phone goes to "Payment to check" and the cashier taps "Received". Option (b) is safer. Tell me which.

### 3–4. Settings to switch on
- Run `supabase/menu_scans.sql` (20 menu photos per restaurant per day).
- Turn on leaked-password protection in Supabase Auth.

### 5. Security headers (Fixed)
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy` (camera and microphone only for this site).

### 7. Super admin confirmation (Fixed)
Changing a client's plan, renewal date, details or status, or resetting the owner's password, now shows "Confirm the change" and needs the super admin password.

## Not production-ready until
Items 1 and 3 are run, item 4 is switched on, and item 2 is decided.
