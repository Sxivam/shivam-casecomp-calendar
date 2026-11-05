import { list } from "@vercel/blob";
import { safeEqual } from "./_lib/auth.js";

// Shivam's private export: /api/export?key=ADMIN_KEY  (add &format=json for JSON)
export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (!safeEqual(url.searchParams.get("key"), process.env.ADMIN_KEY)) return res.status(401).send("Not allowed");

  const rows = new Map();
  let cursor;
  do {
    const r = await list({ prefix: "signups/", cursor, limit: 1000 });
    for (const b of r.blobs) {
      const base = b.pathname.slice(b.pathname.lastIndexOf("/") + 1), i = base.indexOf("__");
      const m = i > 0 && base.endsWith(".json") ? [null, base.slice(i + 2, -5)] : null;
      if (!m) continue;
      let d; try { d = JSON.parse(Buffer.from(m[1], "base64url").toString()); } catch { continue; }
      const k = d.e.toLowerCase(), prev = rows.get(k);
      if (!prev) rows.set(k, { name: d.n, email: d.e, first_seen: d.t, last_seen: d.t, visits: 1 });
      else { prev.visits++; if (d.t < prev.first_seen) prev.first_seen = d.t; if (d.t > prev.last_seen) { prev.last_seen = d.t; prev.name = d.n; } }
    }
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);

  const out = [...rows.values()].sort((a, b) => a.first_seen.localeCompare(b.first_seen));
  res.setHeader("Cache-Control", "no-store");
  if (url.searchParams.get("format") === "json") return res.status(200).json({ total: out.length, signups: out });
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const csv = ["name,email,first_seen,last_seen,visits", ...out.map(r => [r.name, r.email, r.first_seen, r.last_seen, r.visits].map(esc).join(","))].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="signups.csv"`);
  return res.status(200).send(csv);
}
