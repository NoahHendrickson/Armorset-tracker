import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { clientEnv } from "@/lib/env";

export async function GET() {
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/", clientEnv().NEXT_PUBLIC_APP_URL));
}

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
