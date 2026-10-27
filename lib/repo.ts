// The only place screens get data from.
//
// Today: returns the in-memory sample data in lib/mock.ts.
// Next step: re-implement each function against Firestore (see WORKFLOW.md,
// "Firebase plan"). Keep the function names and return types, and the UI
// does not need to change.
import * as mock from "./mock";

export const repo = {
  restaurant: () => mock.restaurant,
  categories: () => mock.categories,
  menu: () => mock.menu,
  tables: () => mock.tables,
  orders: () => mock.orders,
  ingredients: () => mock.ingredients,
  customers: () => mock.customers,
  staff: () => mock.staff,
  feedback: () => mock.feedback,
  leakAlerts: () => mock.leakAlerts,
  campaigns: () => mock.campaigns,
  hourly: () => mock.hourly,
  weekSales: () => mock.weekSales,
  tenants: () => mock.tenants,
  plans: () => mock.plans,
};
