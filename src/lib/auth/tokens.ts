import "server-only";
import { getServiceRoleClient } from "@/lib/db/server";
import { decryptToken, encryptToken } from "./crypto";
import { refreshTokens } from "@/lib/bungie/oauth";
import type { OAuthTokenResponse } from "@/lib/bungie/types";

const ACCESS_SKEW_MS = 60_000;
const LEASE_SECONDS = 45;
const WAIT_BUDGET_MS = 4000;

interface DecodedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function tryAcquireRefreshLease(userId: string): Promise<boolean> {
  const sb = getServiceRoleClient();
  const until = new Date(Date.now() + LEASE_SECONDS * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("oauth_tokens")
    .update({
      refresh_lease_until: until,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .or(`refresh_lease_until.is.null,refresh_lease_until.lt.${nowIso}`)
    .select("user_id")
    .maybeSingle();
  if (error) throw new Error(`tryAcquireRefreshLease failed: ${error.message}`);
  return data !== null;
}

async function releaseRefreshLease(userId: string): Promise<void> {
  const sb = getServiceRoleClient();
  await sb
    .from("oauth_tokens")
    .update({
      refresh_lease_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

async function tryRefreshWithBungie(
  refreshToken: string,
): Promise<OAuthTokenResponse | null> {
  try {
    return await refreshTokens(refreshToken);
  } catch {
    return null;
  }
}

async function ensureRefreshedAccessToken(
  userId: string,
  force: boolean,
): Promise<string | null> {
  const deadline = Date.now() + WAIT_BUDGET_MS;

  while (Date.now() < deadline) {
    const t = await loadTokens(userId);
    if (!t) return null;
    if (t.refreshExpiresAt.getTime() <= Date.now()) return null;
    if (!force && t.expiresAt.getTime() > Date.now() + ACCESS_SKEW_MS) {
      return t.accessToken;
    }

    const acquired = await tryAcquireRefreshLease(userId);
    if (acquired) {
      try {
        const t2 = await loadTokens(userId);
        if (!t2) return null;
        if (t2.refreshExpiresAt.getTime() <= Date.now()) return null;
        if (!force && t2.expiresAt.getTime() > Date.now() + ACCESS_SKEW_MS) {
          return t2.accessToken;
        }

        const refreshed = await tryRefreshWithBungie(t2.refreshToken);
        if (!refreshed) return null;
        await persistTokens(userId, refreshed);
        return refreshed.access_token;
      } finally {
        await releaseRefreshLease(userId);
      }
    }

    await sleep(50 + Math.random() * 100);

    const tAfter = await loadTokens(userId);
    if (!tAfter) return null;
    if (tAfter.refreshExpiresAt.getTime() <= Date.now()) return null;
    if (!force && tAfter.expiresAt.getTime() > Date.now() + ACCESS_SKEW_MS) {
      return tAfter.accessToken;
    }
  }

  const final = await loadTokens(userId);
  if (!final) return null;
  if (final.refreshExpiresAt.getTime() <= Date.now()) return null;
  if (!force && final.expiresAt.getTime() > Date.now() + ACCESS_SKEW_MS) {
    return final.accessToken;
  }
  return null;
}

export async function persistTokens(
  userId: string,
  tokens: OAuthTokenResponse,
): Promise<void> {
  const sb = getServiceRoleClient();
  const now = Date.now();
  const expiresAt = new Date(now + tokens.expires_in * 1000);
  const refreshExpiresAt = new Date(now + tokens.refresh_expires_in * 1000);

  const { error } = await sb.from("oauth_tokens").upsert({
    user_id: userId,
    access_token_encrypted: bufferToHex(encryptToken(tokens.access_token)),
    refresh_token_encrypted: bufferToHex(encryptToken(tokens.refresh_token)),
    expires_at: expiresAt.toISOString(),
    refresh_expires_at: refreshExpiresAt.toISOString(),
    refresh_lease_until: null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`persistTokens failed: ${error.message}`);
}

export async function loadTokens(
  userId: string,
): Promise<DecodedTokens | null> {
  const sb = getServiceRoleClient();
  const { data, error } = await sb
    .from("oauth_tokens")
    .select(
      "access_token_encrypted, refresh_token_encrypted, expires_at, refresh_expires_at",
    )
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return {
    accessToken: decryptToken(
      hexToBuffer(data.access_token_encrypted as unknown as string),
    ),
    refreshToken: decryptToken(
      hexToBuffer(data.refresh_token_encrypted as unknown as string),
    ),
    expiresAt: new Date(data.expires_at),
    refreshExpiresAt: new Date(data.refresh_expires_at),
  };
}

export async function getValidAccessToken(
  userId: string,
): Promise<string | null> {
  const tokens = await loadTokens(userId);
  if (!tokens) return null;
  const now = Date.now();
  if (tokens.expiresAt.getTime() > now + ACCESS_SKEW_MS) {
    return tokens.accessToken;
  }
  if (tokens.refreshExpiresAt.getTime() <= now) {
    return null;
  }
  return ensureRefreshedAccessToken(userId, false);
}

/**
 * Force a token refresh regardless of the cached `expires_at`. Use when Bungie
 * returns 401 despite our DB still considering the access token valid (Bungie
 * can revoke tokens early — server restart, user re-auth elsewhere, etc.).
 *
 * Returns null when the refresh token is also dead, in which case the caller
 * should surface a reconnect-to-Bungie prompt.
 */
export async function forceRefreshAccessToken(
  userId: string,
): Promise<string | null> {
  const tokens = await loadTokens(userId);
  if (!tokens) return null;
  if (tokens.refreshExpiresAt.getTime() <= Date.now()) return null;
  return ensureRefreshedAccessToken(userId, true);
}

function bufferToHex(buf: Buffer): string {
  return `\\x${buf.toString("hex")}`;
}

function hexToBuffer(s: string): Buffer {
  if (s.startsWith("\\x")) return Buffer.from(s.slice(2), "hex");
  if (s.startsWith("0x")) return Buffer.from(s.slice(2), "hex");
  return Buffer.from(s, "base64");
}
