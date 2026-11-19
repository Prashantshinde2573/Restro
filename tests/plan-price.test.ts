import { describe, expect, it } from "vitest";
import { planListPrice, couponOffFor } from "@/components/admin-extras";

describe("plan price is one price per restaurant", () => {
  it("does not depend on the outlets (Pro covers up to 3)", () => {
    expect(planListPrice("pro", 1)).toBe(2999);
    expect(planListPrice("pro", 3)).toBe(8997);
    expect(planListPrice("pro", 6)).toBe(2999 * 5); // 1 month free
    expect(planListPrice("pro", 12)).toBe(29990); // 2 months free
    expect(planListPrice("chain", 1)).toBeNull();
  });
  it("coupon comes off that price", () => {
    expect(couponOffFor({ code: "NEW26", kind: "percent", value: 10 }, 2999)).toBe(300);
    expect(couponOffFor({ code: "FLAT", kind: "flat", value: 5000 }, 2999)).toBe(2999);
  });
});
