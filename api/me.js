import { hasAccess } from "./_lib/auth.js";

// GET -> {unlocked: true|false}. The cookie is httpOnly, so the page asks here to know if this visitor already signed up.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({ unlocked: hasAccess(req) });
}
