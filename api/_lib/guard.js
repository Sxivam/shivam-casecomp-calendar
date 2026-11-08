// Request checks shared by the write endpoints.

// Only the site's own pages may post (blocks other sites making visitors' browsers sign up, and most scripts).
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

export function isJson(req) {
  return String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json");
}

// Names show up in the admin CSV and in the welcome pop-up: keep them to plain text.
export function cleanText(v, max) {
  return String(v || "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}
