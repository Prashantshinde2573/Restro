import { afterAll, describe, expect, it } from "vitest";
import { L, loadDict, setCurrentLang } from "@/lib/i18n-core";

describe("app texts in Marathi / Hindi", () => {
  afterAll(() => setCurrentLang("en"));
  it("English stays exactly as written", () => {
    setCurrentLang("en");
    expect(L("Seat guests")).toBe("Seat guests");
    expect(L("{0} of {1} tables busy", 2, 5)).toBe("2 of 5 tables busy");
  });
  it("Marathi: whole texts, texts with values, and data left as typed", async () => {
    await loadDict();
    setCurrentLang("mr");
    expect(L("Seat guests")).toBe("ग्राहक बसवा");
    expect(L("{0} of {1} tables busy", 2, 5)).toBe("5 पैकी 2 टेबल भरलेले");
    expect(L("Table T4")).toBe("टेबल T4");
    expect(L("Charge ₹431")).toBe("₹431 घ्या");
    expect(L("{0} is asking for the bill", "Table T2")).toBe("टेबल T2 बिल मागत आहे");
    expect(L("Paneer Butter Masala")).toBe("Paneer Butter Masala"); // a dish name
    expect(L(undefined)).toBeUndefined();
  });
  it("Hindi", async () => {
    await loadDict();
    setCurrentLang("hi");
    expect(L("Seat guests")).toBe("ग्राहक बिठाएँ");
    expect(L("12 min ago")).toBe("12 मिनट पहले");
  });
});
