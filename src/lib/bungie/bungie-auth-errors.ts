import "server-only";
import { BungieApiError } from "@/lib/bungie/client";
import {
  BUNGIE_ACCESS_TOKEN_RETRY_ERROR_CODES,
  BUNGIE_FATAL_REFRESH_ERROR_CODES,
  BUNGIE_FATAL_REFRESH_ERROR_DESCRIPTIONS,
} from "@/lib/bungie/platform-error-codes";

/** True when the API call should be retried after forcing an access-token refresh. */
export function bungieErrorRequiresAccessTokenRefresh(err: unknown): boolean {
  if (!(err instanceof BungieApiError)) return false;
  if (err.status === 401) return true;
  if (
    err.errorCode != null &&
    BUNGIE_ACCESS_TOKEN_RETRY_ERROR_CODES.has(err.errorCode)
  ) {
    return true;
  }
  return false;
}

interface OAuthErrorPayload {
  error?: string;
  error_description?: string;
  ErrorCode?: number;
}

/** Parse a Bungie OAuth token endpoint failure body. */
export function parseOAuthErrorPayload(body: string): OAuthErrorPayload | null {
  try {
    return JSON.parse(body) as OAuthErrorPayload;
  } catch {
    return null;
  }
}

/** True when the refresh token is revoked or expired — user must re-authenticate. */
export function isFatalOAuthRefreshFailure(
  status: number,
  body: string,
): boolean {
  if (status === 401 || status === 403) return true;

  const data = parseOAuthErrorPayload(body);
  if (!data) return false;

  if (
    data.error_description &&
    BUNGIE_FATAL_REFRESH_ERROR_DESCRIPTIONS.has(data.error_description)
  ) {
    return true;
  }

  if (
    data.ErrorCode != null &&
    BUNGIE_FATAL_REFRESH_ERROR_CODES.has(data.ErrorCode)
  ) {
    return true;
  }

  return false;
}

/** Network / 5xx refresh failures — do not prompt reconnect. */
export function isTransientOAuthRefreshFailure(status: number): boolean {
  return status < 0 || status >= 500;
}
