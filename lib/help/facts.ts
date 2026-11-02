// Numbers the manuals quote, taken from the app itself so they never go out of date.
import { plans } from "../plans";
import { MEMBER_LIMIT, OUTLET_LIMIT } from "../access";

const rs = (n: number) => "₹" + n.toLocaleString("en-IN");
const p = (id: string) => plans.find((x) => x.id === id)!;

export const PRICE = {
  starter: rs(p("starter").monthly!),
  growth: rs(p("growth").monthly!),
  pro: rs(p("pro").monthly!),
  starterYear: rs(p("starter").yearly!),
  growthYear: rs(p("growth").yearly!),
  proYear: rs(p("pro").yearly!),
  starter6: rs(p("starter").monthly! * 5),
  growth6: rs(p("growth").monthly! * 5),
  pro6: rs(p("pro").monthly! * 5),
};
export const LIMIT = {
  starterStaff: MEMBER_LIMIT.starter,
  proOutlets: OUTLET_LIMIT.pro,
};
export const SUPPORT_EMAIL = "support@restropi.com";
export const MENU_PHOTOS_PER_SCAN = 6;
export const MENU_PHOTOS_PER_DAY = 20;
