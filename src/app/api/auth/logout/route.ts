import { type NextRequest, NextResponse } from "next/server";
import { crossSiteOriginBlockResponse } from "@/lib/auth/api-origin-check";
import { clearSessionCookieOnResponse } from "@/lib/auth/session";

// POST-only on purpose. A GET handler here was being silently invoked by
// Next.js's <Link> prefetch on the dashboard's sign-out icon — every dashboard
// render fired a prefetch to this URL, which returned Set-Cookie clearing the
// session and a 307 to /, and the browser applied the Set-Cookie immediately.
// That was wiping the session cookie milliseconds after sign-in. POST routes
// aren't prefetched, and the origin check below also closes the CSRF hole
// that GET logout had.
export async function POST(req: NextRequest) {
  const blocked = crossSiteOriginBlockResponse(req);
  if (blocked) return blocked;
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  clearSessionCookieOnResponse(res);
  return res;
}
