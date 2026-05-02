import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * CSRF mitigation when session cookies use SameSite=None (needed on some
 * clients, e.g. iOS Safari, to attach cookies to same-origin fetch POST).
 */
function forwardedPublicOrigin(req: NextRequest): string | null {
  const host = req.headers.get("x-forwarded-host");
  if (!host) return null;
  const h = host.split(",")[0].trim();
  if (!h) return null;
  const rawProto = req.headers.get("x-forwarded-proto") ?? "https";
  const p = rawProto.split(",")[0].trim() || "https";
  return `${p}://${h}`;
}

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
  const allowed = new Set<string>([selfOrigin]);
  const pub = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (pub) {
    try {
      allowed.add(new URL(pub).origin);
    } catch {
      /* ignore invalid env */
    }
  }
  const fwd = forwardedPublicOrigin(req);
  if (fwd) {
    allowed.add(fwd);
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
