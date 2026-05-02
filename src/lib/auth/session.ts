import "server-only";
import { cookies, headers } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { serverEnv } from "@/lib/env";
import { getServiceRoleClient } from "@/lib/db/server";
import type { UserRow } from "@/lib/db/types";

export const SESSION_COOKIE = "armor_checklist_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

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

async function signSessionJwt(user: UserRow): Promise<string> {
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
 */
export async function setSessionCookieOnResponse(
  response: NextResponse,
  user: UserRow,
): Promise<void> {
  const jwt = await signSessionJwt(user);
  response.cookies.set(SESSION_COOKIE, jwt, {
    ...sessionCookieBase,
    maxAge: SESSION_TTL_SECONDS,
  });
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

function extractCookieFromHeader(
  header: string | null,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const s = part.trim();
    if (!s.startsWith(`${name}=`)) continue;
    const v = s.slice(name.length + 1);
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return undefined;
}

/**
 * Prefer in Route Handlers — merges `NextRequest` cookies, raw Cookie header
 * (Vercel/Chrome edge cases), and `cookies()` from next/headers.
 */
export async function getSessionFromRequest(
  request: NextRequest,
): Promise<Session | null> {
  const fromNext = request.cookies.get(SESSION_COOKIE)?.value;
  const fromHeader = extractCookieFromHeader(
    request.headers.get("cookie"),
    SESSION_COOKIE,
  );
  const store = await cookies();
  const fromStore = store.get(SESSION_COOKIE)?.value;
  const token = fromNext ?? fromHeader ?? fromStore;
  return sessionFromJwt(token);
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
  const fromHeader = extractCookieFromHeader(h.get("cookie"), SESSION_COOKIE);
  return sessionFromJwt(fromStore ?? fromHeader);
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
