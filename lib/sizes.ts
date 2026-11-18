// Dishes sold in sizes (Pizza S / M / L, Half / Full), each with its own price.
import type { MenuItem } from "./types";

/** The dish's sizes, or none (fewer than two isn't a choice). */
export const sizesOf = (m: Pick<MenuItem, "sizes">) => (m.sizes && m.sizes.length > 1 ? m.sizes : []);
/** Lowest price, for "from ₹250". */
export const fromPrice = (m: Pick<MenuItem, "sizes" | "price">) => (sizesOf(m).length ? Math.min(...sizesOf(m).map((s) => s.price)) : m.price);
export const hasSizes = (m: Pick<MenuItem, "sizes">) => sizesOf(m).length > 0;
/** Something to pick before it goes in the cart (a size, or a required choice). */
export const needsChoice = (m: Pick<MenuItem, "sizes" | "options">) => hasSizes(m) || !!m.options?.some((g) => g.required);
/** Name on the order, kitchen ticket and bill: "Margherita Pizza (L)". */
export const sizedName = (name: string, size?: string) => (size ? `${name} (${size})` : name);
