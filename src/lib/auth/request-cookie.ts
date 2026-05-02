import type { NextRequest } from "next/server";

/**
 * Cookie value for a Route Handler: raw header first (matches browser), then
 * NextRequest's parsed jar (covers header parse quirks).
 */
export function requestCookieValue(
  req: NextRequest,
  name: string,
): string | undefined {
  const raw = req.headers.get("cookie");
  if (raw) {
    for (const part of raw.split(";")) {
      const s = part.trim();
      if (!s.startsWith(`${name}=`)) continue;
      const v = s.slice(name.length + 1);
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return req.cookies.get(name)?.value ?? undefined;
}
