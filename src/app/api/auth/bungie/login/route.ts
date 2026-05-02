import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildAuthorizeUrl } from "@/lib/bungie/oauth";
import {
  BUNGIE_OAUTH_STATE_COOKIE,
  BUNGIE_OAUTH_STATE_TTL_SECONDS,
  bungieOAuthStateCookieOptions,
} from "@/lib/auth/bungie-oauth-cookies";
import {
  bungieOAuthRedirectUri,
  canonicalBungieLoginIfNeeded,
} from "@/lib/auth/bungie-redirect-uri";

export async function GET(req: NextRequest) {
  const canonical = canonicalBungieLoginIfNeeded(req);
  if (canonical) {
    return NextResponse.redirect(canonical, 307);
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = bungieOAuthRedirectUri(req);
  const dest = buildAuthorizeUrl(state, redirectUri);
  const res = NextResponse.redirect(dest);
  res.cookies.set(
    BUNGIE_OAUTH_STATE_COOKIE,
    state,
    bungieOAuthStateCookieOptions(BUNGIE_OAUTH_STATE_TTL_SECONDS),
  );
  return res;
}
