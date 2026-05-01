import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { buildAuthorizeUrl } from "@/lib/bungie/oauth";

const STATE_COOKIE = "armor_checklist_oauth_state";
const STATE_TTL_SECONDS = 10 * 60;

export async function GET() {
  const state = randomBytes(24).toString("hex");
  const c = await cookies();
  c.set({
    name: STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
