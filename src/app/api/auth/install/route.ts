import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { crossSiteOriginBlockResponse } from "@/lib/auth/api-origin-check";

// Same-origin install endpoint: receives the session JWT minted by the OAuth
// callback (embedded in that callback's HTML page) and writes it into the
// session cookie via Set-Cookie on a same-origin POST response.
//
// Why a separate endpoint: setting the session cookie directly on the OAuth
// callback's redirect response (which is initiated by a cross-site top-level
// navigation from bungie.net) was being silently rejected by Chrome despite
// every attribute combination we tried. Same-origin AJAX responses don't
// trigger any of those heuristics — the browser stores the cookie normally.

const bodySchema = z.object({ t: z.string().min(20).max(4096) });

export async function POST(req: NextRequest) {
  const blocked = crossSiteOriginBlockResponse(req);
  if (blocked) return blocked;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const secret = new TextEncoder().encode(serverEnv().APP_SESSION_SECRET);
  try {
    await jwtVerify(parsed.data.t, secret, { clockTolerance: 120 });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd ? "; Secure" : "";
  const setCookie = `${SESSION_COOKIE}=${parsed.data.t}; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secureFlag}; HttpOnly; SameSite=Lax`;

  const res = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  res.headers.append("Set-Cookie", setCookie);
  return res;
}
