import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * CSRF mitigation when session cookies use SameSite=None (needed on some
 * clients, e.g. iOS Safari, to attach cookies to same-origin fetch POST).
 */
export function crossSiteOriginBlockResponse(
  req: NextRequest,
): NextResponse | null {
  const method = req.method;
  if (
    method !== "POST" &&
    method !== "PATCH" &&
    method !== "DELETE" &&
    method !== "PUT"
  ) {
    return null;
  }

  const selfOrigin = new URL(req.url).origin;
  let allowed = new Set<string>([selfOrigin]);
  const pub = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (pub) {
    try {
      allowed.add(new URL(pub).origin);
    } catch {
      /* ignore invalid env */
    }
  }

  const origin = req.headers.get("origin");
  if (origin && allowed.has(origin)) {
    return null;
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      if (allowed.has(new URL(referer).origin)) {
        return null;
      }
    } catch {
      /* ignore */
    }
  }

  if (!origin && !referer) {
    return null;
  }

  return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
}
