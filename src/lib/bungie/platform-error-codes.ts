/**
 * Bungie {@link https://bungie-net.github.io/multi/schema_Exceptions-PlatformErrorCodes.html PlatformErrorCodes}
 * used for OAuth / access-token recovery (aligned with DIM authenticated-fetch).
 */

/** Access token invalid — refresh once and retry the API call. */
export const BUNGIE_ACCESS_TOKEN_RETRY_ERROR_CODES = new Set([
  22, // WebAuthModuleAsyncFailed
  99, // WebAuthRequired
  2111, // AccessTokenHasExpired
  2115, // OAuthAccessTokenExpired
]);

/** Refresh token dead — user must sign in again. */
export const BUNGIE_FATAL_REFRESH_ERROR_CODES = new Set([
  2106, // AuthorizationCodeInvalid
  2110, // RefreshTokenNotYetValid
  2117, // ProvidedTokenNotValidRefreshToken
  2118, // RefreshTokenExpired
  2119, // AuthorizationRecordInvalid
  2122, // AuthorizationCodeStale
  2123, // AuthorizationRecordExpired
  2124, // AuthorizationRecordRevoked
]);

/** OAuth token endpoint `error_description` values that mean reconnect. */
export const BUNGIE_FATAL_REFRESH_ERROR_DESCRIPTIONS = new Set([
  "AuthorizationCodeInvalid",
  "RefreshTokenNotYetValid",
  "AccessTokenHasExpired",
  "AuthorizationRecordExpired",
  "AuthorizationRecordRevoked",
  "AuthorizationCodeStale",
]);
