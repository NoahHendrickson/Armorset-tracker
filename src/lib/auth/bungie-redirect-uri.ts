import type { NextRequest } from "next/server";

/**
 * OAuth redirect_uri and token exchange must use this exact string. It is always
 * derived from the incoming request URL so the Bungie redirect lands on the same
 * host the user started from (Set-Cookie host matches the tab).
 *
 * When `NEXT_PUBLIC_APP_URL` points at a different host than the request, the
 * login route redirects to the canonical URL first — see
 * `canonicalBungieLoginIfNeeded` — so this stays aligned with your Bungie app
 * "Redirect URL" field (one entry per deployment host you actually use).
 */
export function bungieOAuthRedirectUri(req: NextRequest): string {
  return new URL("/api/auth/bungie/callback", req.url).toString();
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "::1"
    );
  } catch {
    return false;
  }
}

/**
 * If `NEXT_PUBLIC_APP_URL` is set, OAuth must run on that origin so the
 * redirect URL registered in the Bungie app (usually a single production URL)
 * matches. Sends users who hit `/api/auth/bungie/login` on another host
 * (preview URL, mistyped domain, etc.) to the canonical login first.
 *
 * Skips redirect when either side is loopback so we never bounce a real
 * deployment to `localhost` because of a bad env paste, and we never force
 * local dev through production.
 */
export function canonicalBungieLoginIfNeeded(req: NextRequest): URL | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    const canonicalOrigin = new URL(raw).origin;
    const requestOrigin = new URL(req.url).origin;
    if (canonicalOrigin === requestOrigin) return null;
    if (isLoopbackOrigin(canonicalOrigin) || isLoopbackOrigin(requestOrigin)) {
      return null;
    }
    const next = new URL("/api/auth/bungie/login", raw);
    next.search = new URL(req.url).search;
    return next;
  } catch {
    return null;
  }
}
