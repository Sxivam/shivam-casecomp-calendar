import { put } from "@vercel/blob";
import crypto from "node:crypto";
import { accessCookie } from "./_lib/auth.js";

// POST {name, email, source} -> saves the signup to the private Blob store and sets the 1-year access cookie.
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/;

function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = body(req);
  const name = String(b.name || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const email = String(b.email || "").trim().toLowerCase().slice(0, 254);
  if (!name) return res.status(400).json({ error: "Please add your name." });
  if (!EMAIL.test(email)) return res.status(400).json({ error: "That email doesn't look right." });

  const at = new Date().toISOString();
  const rec = { name, email, at, source: String(b.source || "").slice(0, 120), ua: String(req.headers["user-agent"] || "").slice(0, 200) };
  // the record also lives in the file name, so the export is one list call (no per-file downloads)
  const key = Buffer.from(JSON.stringify({ n: name, e: email, t: at })).toString("base64url");
  await put(`signups/${at.replace(/[:.]/g, "-")}-${crypto.randomBytes(4).toString("hex")}__${key}.json`, JSON.stringify(rec), {
    access: "private", addRandomSuffix: false, contentType: "application/json",
  });

  res.setHeader("Set-Cookie", accessCookie(email));
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true, name });
}
