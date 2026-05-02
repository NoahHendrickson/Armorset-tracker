/** Cookie name for Bungie OAuth CSRF `state` (must match login + callback). */
export const BUNGIE_OAUTH_STATE_COOKIE = "armor_checklist_oauth_state";

/** Allow slow Bungie → Steam → Bungie flows. */
export const BUNGIE_OAUTH_STATE_TTL_SECONDS = 30 * 60;

/**
 * In production, `SameSite=Lax` can drop the state cookie on the return hop
 * from bungie.net after external IdP (Steam) sign-in. `none` + `secure` keeps
 * the cookie on cross-site top-level navigations to our callback.
 */
export function bungieOAuthStateCookieOptions(maxAge: number) {
  const prod = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    path: "/",
    maxAge,
    secure: prod,
    sameSite: (prod ? "none" : "lax") as "none" | "lax",
  };
}

