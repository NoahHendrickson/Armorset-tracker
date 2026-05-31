import "server-only";
import { bungieErrorRequiresAccessTokenRefresh } from "@/lib/bungie/bungie-auth-errors";
import { BUNGIE_REAUTH_USER_MESSAGE } from "@/lib/auth/bungie-reauth";
import {
  forceRefreshAccessToken,
  getValidAccessToken,
  TokenRefreshTransientError,
} from "@/lib/auth/tokens";
import { InventoryNotReady } from "@/lib/inventory/inventory-not-ready";

/**
 * Run a Bungie API call with the current access token; on auth failure (HTTP 401
 * or platform codes like AccessTokenHasExpired), force-refresh once and retry.
 */
export async function withBungieAccessTokenRetry<T>(
  userId: string,
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  const token = await getValidAccessToken(userId);
  if (!token) {
    throw new InventoryNotReady(BUNGIE_REAUTH_USER_MESSAGE, 401);
  }

  try {
    return await fn(token);
  } catch (err) {
    if (err instanceof TokenRefreshTransientError) {
      throw new InventoryNotReady(
        "Could not refresh Bungie session — try again in a moment.",
        503,
      );
    }
    if (!bungieErrorRequiresAccessTokenRefresh(err)) throw err;

    let refreshed: string | null;
    try {
      refreshed = await forceRefreshAccessToken(userId);
    } catch (refreshErr) {
      if (refreshErr instanceof TokenRefreshTransientError) {
        throw new InventoryNotReady(
          "Could not refresh Bungie session — try again in a moment.",
          503,
        );
      }
      throw refreshErr;
    }

    if (!refreshed) {
      throw new InventoryNotReady(BUNGIE_REAUTH_USER_MESSAGE, 401);
    }

    try {
      return await fn(refreshed);
    } catch (retryErr) {
      if (retryErr instanceof TokenRefreshTransientError) {
        throw new InventoryNotReady(
          "Could not refresh Bungie session — try again in a moment.",
          503,
        );
      }
      if (bungieErrorRequiresAccessTokenRefresh(retryErr)) {
        throw new InventoryNotReady(BUNGIE_REAUTH_USER_MESSAGE, 401);
      }
      throw retryErr;
    }
  }
}
