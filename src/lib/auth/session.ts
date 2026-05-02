import "server-only";
import { cookies, headers } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { serverEnv } from "@/lib/env";
import { getServiceRoleClient } from "@/lib/db/server";
import type { UserRow } from "@/lib/db/types";

export const SESSION_COOKIE = "armor_checklist_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface Session {
  userId: string;
  bungieMembershipId: string;
  bungieMembershipType: number;
  displayName: string;
  issuedAt: number;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(serverEnv().APP_SESSION_SECRET);
}

/**
 * Production uses SameSite=None so iOS Safari reliably attaches this cookie to
 * same-origin fetch() POST (Lax alone often omits it). Secure is required.
 * CSRF is mitigated via {@link crossSiteOriginBlockResponse} on mutating routes.
 */
const sessionCookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as
    | "none"
    | "lax",
  path: "/",
};

export async function signSessionJwt(user: UserRow): Promise<string> {
  return new SignJWT({
    bmid: user.bungie_membership_id,
    bmt: user.bungie_membership_type,
    name: user.display_name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

/**
 * Prefer this in Route Handlers that return NextResponse.redirect — mutating
 * `cookies()` does not reliably attach Set-Cookie to a new Response object.
 *
 * Emits Set-Cookie via raw header append rather than NextResponse.cookies.set:
 * the latter auto-adds an `Expires=` attribute alongside `Max-Age=` once the
 * lifetime is large, and that two-attribute Set-Cookie format wasn't being
 * persisted by Chrome on the OAuth callback redirect even though the
 * single-attribute test cookie with the same Secure/HttpOnly/SameSite=None
 * combo persisted fine. Hand-crafted Set-Cookie matches the test-cookie shape
 * exactly.
 */
export async function setSessionCookieOnResponse(
  response: NextResponse,
  user: UserRow,
): Promise<void> {
  const jwt = await signSessionJwt(user);
  const isProd = process.env.NODE_ENV === "production";
  // SameSite=Lax (not None): browsers store Lax cookies set on top-level
  // navigations (which the OAuth callback redirect is) without the
  // tracking-suspicion heuristics that apply to SameSite=None. Lax also
  // attaches on every request the app actually makes — the site is
  // navigated to top-level (clicks/typed URL/redirects) and only ever
  // calls its own /api/* via same-origin fetch, both of which carry Lax
  // cookies. None was leftover from a misdiagnosed iOS Safari issue.
  const secureFlag = isProd ? "; Secure" : "";
  const setCookie = `${SESSION_COOKIE}=${jwt}; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secureFlag}; HttpOnly; SameSite=Lax`;
  response.headers.append("Set-Cookie", setCookie);
}

export function clearSessionCookieOnResponse(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieBase,
    maxAge: 0,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.set({
    name: SESSION_COOKIE,
    value: "",
    ...sessionCookieBase,
    maxAge: 0,
  });
}

async function sessionFromJwt(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      clockTolerance: 120,
    });
    return {
      userId: payload.sub as string,
      bungieMembershipId: payload.bmid as string,
      bungieMembershipType: payload.bmt as number,
      displayName: payload.name as string,
      issuedAt: payload.iat ?? 0,
    };
  } catch {
    return null;
  }
}

function nonEmptyCandidates(...values: (string | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (typeof v !== "string" || v.length === 0) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

async function firstVerifiedSession(
  tokens: string[],
): Promise<Session | null> {
  for (const t of tokens) {
    const s = await sessionFromJwt(t);
    if (s) return s;
  }
  return null;
}

/** Every value for `name` in the header (browsers may send duplicates). */
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

/**
 * Prefer in Route Handlers — merges `NextRequest` cookies, raw Cookie header
 * (Vercel/Chrome edge cases), and `cookies()` from next/headers.
 */
export async function getSessionFromRequest(
  request: NextRequest,
): Promise<Session | null> {
  // Prefer raw Cookie header first (browser source of truth). Try every
  // non-empty candidate: a bad parse/empty cookie value must not shadow a valid JWT.
  const headerValues = extractAllCookieValuesFromHeader(
    request.headers.get("cookie"),
    SESSION_COOKIE,
  );
  const fromNext = request.cookies.get(SESSION_COOKIE)?.value;
  const store = await cookies();
  const fromStore = store.get(SESSION_COOKIE)?.value;
  return firstVerifiedSession(
    nonEmptyCandidates(...headerValues, fromNext, fromStore),
  );
}

export async function requireSessionFromRequest(
  request: NextRequest,
): Promise<Session> {
  const session = await getSessionFromRequest(request);
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const fromStore = c.get(SESSION_COOKIE)?.value;
  const h = await headers();
  const headerValues = extractAllCookieValuesFromHeader(
    h.get("cookie"),
    SESSION_COOKIE,
  );
  return firstVerifiedSession(
    nonEmptyCandidates(...headerValues, fromStore),
  );
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function getSessionUser(): Promise<UserRow | null> {
  const session = await getSession();
  if (!session) return null;
  const sb = getServiceRoleClient();
  const { data, error } = await sb
    .from("users")
    .select("*")
    .eq("id", session.userId)
    .single();
  if (error || !data) return null;
  return data;
}
