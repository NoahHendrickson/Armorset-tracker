import type { NextRequest, NextResponse } from "next/server";
import { requestCookieValue } from "@/lib/auth/request-cookie";

/** HttpOnly cookie holding a post-OAuth redirect path (dashboard + optional query). */
export const POST_AUTH_RETURN_COOKIE = "armor_checklist_return";

export const POST_AUTH_RETURN_TTL_SECONDS = 10 * 60;

const MAX_RETURN_PATH_LENGTH = 2048;

const DASHBOARD_RETURN_RE = /^\/dashboard(\?[^#]*)?$/;

/**
 * Allow only relative `/dashboard` paths (optionally with query) to block open redirects.
 */
export function sanitizePostAuthReturnPath(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_RETURN_PATH_LENGTH) {
    return null;
  }
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("\\")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return null;
  }
  if (decoded.includes("\\") || decoded.startsWith("//")) return null;
  if (!DASHBOARD_RETURN_RE.test(decoded)) return null;
  return decoded;
}

export function postAuthReturnCookieOptions(maxAge: number) {
  const prod = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    path: "/",
    maxAge,
    secure: prod,
    sameSite: "lax" as const,
  };
}

export function defaultPostAuthReturnPath(): string {
  return "/dashboard";
}

export function readPostAuthReturnCookie(req: NextRequest): string | null {
  const raw = requestCookieValue(req, POST_AUTH_RETURN_COOKIE);
  return sanitizePostAuthReturnPath(raw ?? null);
}

export function setPostAuthReturnCookie(
  res: NextResponse,
  path: string,
): void {
  const safe = sanitizePostAuthReturnPath(path);
  if (!safe) return;
  res.cookies.set(
    POST_AUTH_RETURN_COOKIE,
    safe,
    postAuthReturnCookieOptions(POST_AUTH_RETURN_TTL_SECONDS),
  );
}

export function clearPostAuthReturnCookie(res: NextResponse): void {
  res.cookies.set(
    POST_AUTH_RETURN_COOKIE,
    "",
    postAuthReturnCookieOptions(0),
  );
}
