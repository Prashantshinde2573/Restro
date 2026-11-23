// Smart stock: what an item will need tomorrow and how long it lasts.
// Built from three things:
//  1. recipe use — every paid plate takes its recipe off stock (the server keeps a daily total);
//  2. real use — stock counts teach how far the kitchen is from the recipe (item.adjust);
//  3. the pattern — the same weekday over the last 4 weeks and the last 7 days, plus tomorrow's expected plates.
import type { MenuItem, StockItem } from "./types";

export const dayKey = (t: number | Date) => {
  // India time, like the server
  const d = new Date((t instanceof Date ? t.getTime() : t) + 5.5 * 3600_000);
  return d.toISOString().slice(0, 10);
};
const DAY = 86_400_000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export interface StockForecast {
  today: number; // used today (real, adjusted)
  avg7: number; // average a day over the last 7 days (real)
  tomorrow: number; // expected tomorrow (real)
  daysLeft: number | null; // at the expected rate; null when nothing is used
  adjust: number;
  /** how sure: "learning" until there is a week of use */
  basis: "recipe" | "history" | "both" | "learning";
}

/**
 * @param recipeTomorrow  what tomorrow's expected plates need of this item by recipe (optional)
 */
export function forecastItem(item: Pick<StockItem, "stock" | "usage" | "adjust">, now = Date.now(), recipeTomorrow?: number): StockForecast {
  const u = item.usage ?? {};
  const adj = item.adjust && item.adjust > 0 ? item.adjust : 1;
  const at = (k: number) => u[dayKey(now - k * DAY)] ?? 0;
  const today = at(0);
  const keys = Object.keys(u).sort();
  const firstDay = keys[0];
  // days with records in the last 7 full days (don't average over days before tracking started)
  const span7 = [1, 2, 3, 4, 5, 6, 7].filter((k) => !firstDay || dayKey(now - k * DAY) >= firstDay);
  const avg7 = span7.length ? span7.reduce((s, k) => s + at(k), 0) / span7.length : 0;
  const tomorrowDay = now + DAY;
  const sameDay = [1, 2, 3, 4].map((w) => dayKey(tomorrowDay - w * 7 * DAY)).filter((d) => !firstDay || d >= firstDay);
  const sameAvg = sameDay.length ? sameDay.reduce((s, d) => s + (u[d] ?? 0), 0) / sameDay.length : 0;
  const history = sameDay.length >= 2 ? 0.6 * sameAvg + 0.4 * avg7 : avg7;
  const hasHistory = span7.length >= 3 && avg7 > 0;
  const hasRecipe = recipeTomorrow !== undefined && recipeTomorrow > 0;
  const base = hasRecipe && hasHistory ? (recipeTomorrow! + history) / 2 : hasRecipe ? recipeTomorrow! : history;
  const tomorrow = r3(base * adj);
  const rate = Math.max(tomorrow, avg7 * adj);
  return {
    today: r3(today * adj),
    avg7: r3(avg7 * adj),
    tomorrow,
    daysLeft: rate > 0 ? Math.round((item.stock / rate) * 10) / 10 : null,
    adjust: adj,
    basis: hasRecipe && hasHistory ? "both" : hasRecipe ? "recipe" : hasHistory ? "history" : "learning",
  };
}

/** What tomorrow's expected plates need from each stock item, by recipe: stockId → qty. */
export function recipeNeeds(plates: { id: string; plates: number }[], menu: Pick<MenuItem, "id" | "recipe">[]) {
  const need = new Map<string, number>();
  for (const p of plates) {
    const m = menu.find((x) => x.id === p.id);
    for (const r of m?.recipe ?? []) need.set(r.stockId, (need.get(r.stockId) ?? 0) + r.qty * p.plates);
  }
  return need;
}

/** How much to buy: enough for `days` days at the expected rate, at least back to the minimum level. */
export function toOrder(item: Pick<StockItem, "stock" | "par">, f: Pick<StockForecast, "tomorrow" | "avg7">, days = 3) {
  const rate = Math.max(f.tomorrow, f.avg7);
  const want = Math.max(item.par, rate * days);
  const need = want - item.stock;
  return need > 0 ? Math.ceil(need * 2) / 2 : 0;
}

/** Recipe cost of one plate (₹), from the stock items' cost per unit. */
export function recipeCost(recipe: MenuItem["recipe"], stock: Pick<StockItem, "id" | "costPerUnit">[]) {
  return Math.round((recipe ?? []).reduce((s, r) => s + r.qty * (stock.find((x) => x.id === r.stockId)?.costPerUnit ?? 0), 0));
}
