import crypto from "node:crypto";

const SECRET = process.env.ACCESS_SECRET || "";
const b64u = s => Buffer.from(s).toString("base64url");
const sign = v => crypto.createHmac("sha256", SECRET).update(v).digest("base64url");

// cookie = base64url(email) + "." + HMAC(email). One year, httpOnly.
export function accessCookie(email) {
  const v = b64u(email.toLowerCase());
  return `wg_access=${v}.${sign(v)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
}

export function hasAccess(req) {
  if (!SECRET) return false;
  const m = /(?:^|;\s*)wg_access=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/.exec(req.headers.cookie || "");
  if (!m) return false;
  const a = Buffer.from(sign(m[1])), b = Buffer.from(m[2]);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function safeEqual(x, y) {
  const a = Buffer.from(String(x || "")), b = Buffer.from(String(y || ""));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}
