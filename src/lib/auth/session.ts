import "server-only";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
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

const sessionCookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
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

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
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
