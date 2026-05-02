import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { BUNGIE_OAUTH_STATE_COOKIE } from "@/lib/auth/bungie-oauth-cookies";

// Diagnostic endpoint for auth debugging. Returns JSON describing the request
// and any cookies the server can see — never the values themselves, only
// presence/length/verify-status. Safe to leave deployed (no secrets leaked).
//
// Usage:
//   GET /api/debug/auth          → inspect request + cookies
//   GET /api/debug/auth?set=1    → also Set-Cookie a harmless test cookie
//                                    with the same attributes as the session
//                                    cookie. If the test cookie also fails to
//                                    appear in DevTools, the problem is
//                                    cookie-storage-side, not OAuth-side.

function extractAllCookieValuesFromHeader(
  header: string | null,
  name: string,
): string[] {
  if (!header) return [];
  const out: string[] = [];
  for (const part of header.split(";")) {
    const s = part.trim();
    if (!s.startsWith(`${name}=`)) continue;
    const v = s.slice(name.length + 1);
    try {
      out.push(decodeURIComponent(v));
    } catch {
      out.push(v);
    }
  }
  return out;
}

async function tryVerify(
  token: string,
  secret: Uint8Array | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!secret) return { ok: false, error: "no APP_SESSION_SECRET" };
  try {
    await jwtVerify(token, secret, { clockTolerance: 120 });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? `${err.name}: ${err.message}` : "verify failed",
    };
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const cookieHeader = req.headers.get("cookie");
  const sessionVals = extractAllCookieValuesFromHeader(cookieHeader, SESSION_COOKIE);
  const stateVals = extractAllCookieValuesFromHeader(
    cookieHeader,
    BUNGIE_OAUTH_STATE_COOKIE,
  );
  const fromNextRequestSession = req.cookies.get(SESSION_COOKIE)?.value ?? null;

  const rawSecret = process.env.APP_SESSION_SECRET ?? "";
  const trimmedSecret = rawSecret.trim();
  const secretBytes = trimmedSecret.length
    ? new TextEncoder().encode(trimmedSecret)
    : null;

  const verifications = await Promise.all(
    sessionVals.map((v) => tryVerify(v, secretBytes)),
  );
  const verifyFromNextReq = fromNextRequestSession
    ? await tryVerify(fromNextRequestSession, secretBytes)
    : null;

  const cookieNames = (cookieHeader ?? "")
    .split(";")
    .map((s) => s.trim().split("=")[0])
    .filter(Boolean);

  const wantSet = url.searchParams.get("set") === "1";
  const testCookieAttempted = wantSet
    ? {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
        maxAge: 600,
      }
    : null;

  const res = NextResponse.json(
    {
      request: {
        url: req.url,
        host: url.host,
        protocol: url.protocol,
        origin: url.origin,
        method: req.method,
      },
      headers: {
        host: req.headers.get("host"),
        "x-forwarded-host": req.headers.get("x-forwarded-host"),
        "x-forwarded-proto": req.headers.get("x-forwarded-proto"),
        origin: req.headers.get("origin"),
        referer: req.headers.get("referer"),
        "user-agent": req.headers.get("user-agent"),
      },
      env: {
        NODE_ENV: process.env.NODE_ENV ?? null,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
        APP_SESSION_SECRET_present: rawSecret.length > 0,
        APP_SESSION_SECRET_raw_len: rawSecret.length,
        APP_SESSION_SECRET_trimmed_len: trimmedSecret.length,
        APP_SESSION_SECRET_was_trimmed: rawSecret.length !== trimmedSecret.length,
      },
      cookies: {
        cookie_header_present: cookieHeader !== null,
        cookie_header_length: cookieHeader?.length ?? 0,
        cookie_names_in_header: cookieNames,
        session_cookie_count_in_header: sessionVals.length,
        session_cookie_lengths_in_header: sessionVals.map((v) => v.length),
        session_cookie_from_NextRequest_present: fromNextRequestSession !== null,
        oauth_state_cookie_count_in_header: stateVals.length,
      },
      sessionVerification: {
        from_header_results: verifications,
        from_next_request_result: verifyFromNextReq,
      },
      testCookieAttempted,
    },
    { headers: { "Cache-Control": "no-store" } },
  );

  if (wantSet) {
    res.cookies.set("armor_checklist_debug_test", "ok", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      maxAge: 600,
    });
  }

  return res;
}
