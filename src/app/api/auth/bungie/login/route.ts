import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildAuthorizeUrl } from "@/lib/bungie/oauth";
import {
  BUNGIE_OAUTH_STATE_COOKIE,
  BUNGIE_OAUTH_STATE_TTL_SECONDS,
} from "@/lib/auth/bungie-oauth-cookies";

export async function GET() {
  const state = randomBytes(24).toString("hex");
  const dest = buildAuthorizeUrl(state);
  const res = NextResponse.redirect(dest);
  res.cookies.set(BUNGIE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: BUNGIE_OAUTH_STATE_TTL_SECONDS,
  });
  return res;
}
