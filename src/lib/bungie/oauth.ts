import "server-only";
import { BUNGIE_AUTH_URL, BUNGIE_TOKEN_URL } from "./constants";
import { serverEnv } from "@/lib/env";
import type { OAuthTokenResponse } from "./types";

export function buildAuthorizeUrl(state: string): string {
  const env = serverEnv();
  const url = new URL(BUNGIE_AUTH_URL);
  url.searchParams.set("client_id", env.BUNGIE_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeAuthorizationCode(
  code: string,
): Promise<OAuthTokenResponse> {
  const env = serverEnv();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: env.BUNGIE_CLIENT_ID,
  });
  if (env.BUNGIE_CLIENT_SECRET) {
    body.set("client_secret", env.BUNGIE_CLIENT_SECRET);
  }

  const res = await fetch(BUNGIE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-API-Key": env.BUNGIE_API_KEY,
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Bungie token exchange failed: ${res.status} ${res.statusText} — ${await res.text()}`,
    );
  }
  return (await res.json()) as OAuthTokenResponse;
}

export async function refreshTokens(refreshToken: string): Promise<OAuthTokenResponse> {
  const env = serverEnv();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.BUNGIE_CLIENT_ID,
  });
  if (env.BUNGIE_CLIENT_SECRET) {
    body.set("client_secret", env.BUNGIE_CLIENT_SECRET);
  }

  const res = await fetch(BUNGIE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-API-Key": env.BUNGIE_API_KEY,
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Bungie token refresh failed: ${res.status} ${res.statusText} — ${await res.text()}`,
    );
  }
  return (await res.json()) as OAuthTokenResponse;
}
