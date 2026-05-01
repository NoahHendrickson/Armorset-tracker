import "server-only";
import { cookies } from "next/headers";
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

export async function createSessionCookie(user: UserRow): Promise<void> {
  const jwt = await new SignJWT({
    bmid: user.bungie_membership_id,
    bmt: user.bungie_membership_type,
    name: user.display_name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());

  const c = await cookies();
  c.set({
    name: SESSION_COOKIE,
    value: jwt,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
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
