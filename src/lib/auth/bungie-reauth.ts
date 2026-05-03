/**
 * Shared contract for when Bungie OAuth tokens cannot be refreshed (API + client).
 * Keep this module free of `server-only` so client components can import it.
 */
export const BUNGIE_REAUTH_REQUIRED_CODE = "bungie_reauth_required" as const;

export const BUNGIE_RECONNECT_PATH = "/api/auth/bungie/login" as const;

export const BUNGIE_REAUTH_USER_MESSAGE =
  "Your Bungie link expired — reconnect to refresh your inventory.";
