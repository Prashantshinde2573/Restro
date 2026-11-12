export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const cleanEmail = (v: unknown) => {
  const e = String(v ?? "").trim().toLowerCase();
  return e.length <= 160 && EMAIL_RE.test(e) ? e : null;
};

/** Only accept JSON posts from our own pages (blocks other sites posting forms to these routes). */
export function sameSite(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // server-to-server / curl: other checks still apply
  try {
    const o = new URL(origin).host;
    const h = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return o === h || /(^|\.)restropi\.com$/.test(o) || /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  } catch {
    return false;
  }
}
