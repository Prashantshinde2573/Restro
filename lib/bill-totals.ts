import { gstRate } from "./format";

/** A bill's totals: GST on the amount after discount, rounded to the rupee (round-off shown). */
export function billTotals(subtotal: number, discount = 0) {
  const taxable = Math.max(0, subtotal - discount);
  const gst = Math.round(taxable * gstRate() * 100) / 100;
  const total = Math.round(taxable + gst);
  return { subtotal, discount, taxable, cgst: gst / 2, sgst: gst / 2, roundOff: total - (taxable + gst), total };
}
