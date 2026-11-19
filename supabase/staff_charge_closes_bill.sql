-- Staff the owner lets "Charge bills" close a bill themselves (no owner confirmation).
-- Applied as migration staff_with_charge_close_bills (19 Nov 2026).
-- Changing how a paid bill was paid still needs "Confirm payments" or "Change how a bill was paid".
create or replace function private.can_close_bill(r text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_perm(r, 'confirmPay') or private.has_perm(r, 'charge')
$$;
revoke all on function private.can_close_bill(text) from public, anon;
-- private.guard_guest_order(): the two "This bill needs the owner's confirmation" checks
-- now use private.can_close_bill(new.rid) instead of private.can_confirm_pay(new.rid).
