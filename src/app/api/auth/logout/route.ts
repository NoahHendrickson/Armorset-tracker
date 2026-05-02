import { type NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, clearSessionCookieOnResponse } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url));
  clearSessionCookieOnResponse(res);
  return res;
}

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
