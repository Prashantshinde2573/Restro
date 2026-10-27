# Restro

Restaurant and café management SaaS — billing, kitchen, tables, stock, team,
guests and reports, with an AI layer (Pulse briefing, prep forecast, Leak
guard, voice ordering).

**Status:** UI and workflow prototype with sample data. Firebase comes next —
see [`WORKFLOW.md`](./WORKFLOW.md).

## Run it

Needs Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

| Page | URL |
|---|---|
| Landing + pricing | http://localhost:3000 |
| Restaurant app (Pulse) | http://localhost:3000/app |
| New order (POS) | http://localhost:3000/app/pos |
| Kitchen display | http://localhost:3000/app/kitchen |
| Guest QR ordering (open on your phone) | http://localhost:3000/order/T3 |
| Sign in | http://localhost:3000/login |
| Onboarding | http://localhost:3000/onboarding |
| Your admin console | http://localhost:3000/admin |

To try it on your phone: run `npm run dev -- -H 0.0.0.0`, then open
`http://<your Mac's IP>:3000` on a phone on the same Wi-Fi. On iPhone, Share →
Add to Home Screen makes it open like an app.

## Project layout

```
app/                 pages (Next.js App Router)
  app/               the restaurant app (/app/...)
  order/[table]/     guest QR ordering
  admin/             platform owner console
components/          shell (sidebar + tab bar), ui kit, checkout, voice, QR
lib/
  types.ts           data types (match the planned Firestore documents)
  mock.ts            sample data
  repo.ts            the only data access point → swap for Firebase
  i18n.tsx           English / मराठी / हिंदी
```

## Design

- Colours are tokens in `app/globals.css` (porcelain canvas, white grouped
  surfaces, jade for actions, saffron only for Pulse/AI moments). The kitchen
  screen uses the dark set.
- Typeface: Instrument Sans (bundled, works offline).
- Phones: large titles, bottom tab bar, bottom sheets. Laptops/tablets:
  sidebar and side panels.
