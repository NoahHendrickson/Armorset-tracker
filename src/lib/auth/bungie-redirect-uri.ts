import type { NextRequest } from "next/server";

/**
 * Must match the Redirect URL registered on the Bungie app **exactly** (scheme,
 * host, path). Prefer `NEXT_PUBLIC_APP_URL` so it matches Vercel env + Bungie.
 */
export function bungieOAuthRedirectUri(req: NextRequest): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      return `${new URL(raw).origin}/api/auth/bungie/callback`;
    } catch {
      /* fall through */
    }
  }
  return new URL("/api/auth/bungie/callback", req.url).toString();
}
