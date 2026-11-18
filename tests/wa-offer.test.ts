import { describe, expect, it } from "vitest";
import { offerBlock, withOffer } from "@/lib/wa-templates";

const pct = { code: "WELCOME10", kind: "percent" as const, value: 10, maxOff: 100, minBill: 300, validTo: "2026-11-30" };

describe("WhatsApp offer block", () => {
  it("lays out the offer, code, dates and how to use it", () => {
    const b = offerBlock(pct, "en", "Chai Point Café");
    expect(b).toContain("*Chai Point Café – Special offer!*");
    expect(b).toContain("*10% OFF* (up to ₹100)");
    expect(b).toContain("Code: *WELCOME10*");
    expect(b).toContain("Valid till 30 Nov · on bills of ₹300+");
    expect(b).toContain("enter *WELCOME10*");
  });
  it("leaves out lines the coupon doesn't have, with no double blank lines", () => {
    const b = offerBlock({ code: "FLAT50", kind: "flat", value: 50 }, "mr", "Cafe");
    expect(b).toContain("*₹50 सूट*");
    expect(b).not.toContain("📅");
    expect(b).not.toMatch(/\n\n\n/);
  });
  it("replaces an earlier offer (and the old one-line offer) instead of stacking", () => {
    let m = "Hi {name}!\n\n🎁 10% off with code *WELCOME10*";
    m = withOffer(m, offerBlock(pct, "en", "Cafe"));
    m = withOffer(m, offerBlock({ code: "FLAT50", kind: "flat", value: 50 }, "en", "Cafe"));
    expect(m.startsWith("Hi {name}!\n\n🎉")).toBe(true);
    expect(m).toContain("FLAT50");
    expect(m).not.toContain("WELCOME10");
    expect(m.match(/🎉/g)?.length).toBe(1);
  });
});
