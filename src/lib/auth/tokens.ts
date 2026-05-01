import "server-only";
import { getServiceRoleClient } from "@/lib/db/server";
import { decryptToken, encryptToken } from "./crypto";
import { refreshTokens } from "@/lib/bungie/oauth";
import type { OAuthTokenResponse } from "@/lib/bungie/types";

interface DecodedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
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
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`persistTokens failed: ${error.message}`);
}

export async function loadTokens(userId: string): Promise<DecodedTokens | null> {
  const sb = getServiceRoleClient();
  const { data, error } = await sb
    .from("oauth_tokens")
    .select("access_token_encrypted, refresh_token_encrypted, expires_at, refresh_expires_at")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return {
    accessToken: decryptToken(hexToBuffer(data.access_token_encrypted as unknown as string)),
    refreshToken: decryptToken(hexToBuffer(data.refresh_token_encrypted as unknown as string)),
    expiresAt: new Date(data.expires_at),
    refreshExpiresAt: new Date(data.refresh_expires_at),
  };
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const tokens = await loadTokens(userId);
  if (!tokens) return null;
  const now = Date.now();
  if (tokens.expiresAt.getTime() > now + 60_000) {
    return tokens.accessToken;
  }
  if (tokens.refreshExpiresAt.getTime() <= now) {
    return null;
  }
  const refreshed = await refreshTokens(tokens.refreshToken);
  await persistTokens(userId, refreshed);
  return refreshed.access_token;
}

function bufferToHex(buf: Buffer): string {
  return `\\x${buf.toString("hex")}`;
}

function hexToBuffer(s: string): Buffer {
  if (s.startsWith("\\x")) return Buffer.from(s.slice(2), "hex");
  if (s.startsWith("0x")) return Buffer.from(s.slice(2), "hex");
  return Buffer.from(s, "base64");
}
