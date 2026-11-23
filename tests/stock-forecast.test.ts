import { describe, expect, it } from "vitest";
import { dayKey, forecastItem, recipeCost, recipeNeeds, toOrder } from "@/lib/stock-forecast";

const NOW = Date.UTC(2026, 10, 23, 6, 0); // Mon 23 Nov 2026, 11:30 IST
const day = (k: number) => dayKey(NOW - k * 86_400_000);

describe("smart stock", () => {
  it("learns nothing from an empty history", () => {
    const f = forecastItem({ stock: 10 }, NOW);
    expect(f.basis).toBe("learning");
    expect(f.tomorrow).toBe(0);
    expect(f.daysLeft).toBeNull();
  });

  it("uses the last 7 days and the same weekday", () => {
    const usage: Record<string, number> = {};
    for (let k = 0; k <= 28; k++) usage[day(k)] = 2; // 2 kg every day
    usage[day(6)] = 4; // the last three Tuesdays were busier (tomorrow is a Tuesday)
    usage[day(13)] = 4;
    usage[day(20)] = 4;
    usage[day(27)] = 4;
    const f = forecastItem({ stock: 8, usage }, NOW);
    expect(f.basis).toBe("history");
    // avg7 = (2*6 + 4)/7 = 2.286; same weekday = 4 → 0.6*4 + 0.4*2.286 = 3.314
    expect(f.tomorrow).toBeCloseTo(3.314, 2);
    expect(f.today).toBe(2);
    expect(f.daysLeft).toBeCloseTo(2.4, 1);
  });

  it("applies what the counts learned (uses 10% more than the recipe)", () => {
    const usage: Record<string, number> = {};
    for (let k = 0; k <= 7; k++) usage[day(k)] = 2;
    const f = forecastItem({ stock: 8, usage, adjust: 1.1 }, NOW);
    expect(f.tomorrow).toBeCloseTo(2.2, 3);
    expect(f.today).toBeCloseTo(2.2, 3);
  });

  it("mixes in tomorrow's expected plates by recipe", () => {
    const usage: Record<string, number> = {};
    for (let k = 0; k <= 7; k++) usage[day(k)] = 2;
    const f = forecastItem({ stock: 8, usage }, NOW, 3);
    expect(f.basis).toBe("both");
    expect(f.tomorrow).toBe(2.5);
    expect(forecastItem({ stock: 8 }, NOW, 3).basis).toBe("recipe");
  });

  it("adds up recipe needs, buys for 3 days and prices a plate", () => {
    const menu = [{ id: "pbm", recipe: [{ stockId: "paneer", qty: 0.15 }, { stockId: "butter", qty: 0.02 }] }, { id: "naan", recipe: [{ stockId: "butter", qty: 0.01 }] }];
    const need = recipeNeeds([{ id: "pbm", plates: 20 }, { id: "naan", plates: 50 }], menu);
    expect(need.get("paneer")).toBeCloseTo(3, 6);
    expect(need.get("butter")).toBeCloseTo(0.9, 6);
    expect(toOrder({ stock: 8, par: 3 }, { tomorrow: 3, avg7: 2 })).toBe(1); // 9 − 8
    expect(toOrder({ stock: 1, par: 3 }, { tomorrow: 0, avg7: 0 })).toBe(2); // back to the minimum
    expect(recipeCost(menu[0].recipe, [{ id: "paneer", costPerUnit: 300 }, { id: "butter", costPerUnit: 500 }])).toBe(55);
  });
});
