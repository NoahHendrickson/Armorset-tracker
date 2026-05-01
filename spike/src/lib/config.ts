import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const TOKENS_PATH = resolve(process.cwd(), ".tokens.json");
export const MANIFEST_CACHE_DIR = resolve(process.cwd(), "manifest-cache");

export const BUNGIE_AUTH_URL = "https://www.bungie.net/en/OAuth/Authorize";
export const BUNGIE_TOKEN_URL = "https://www.bungie.net/Platform/App/OAuth/Token/";
export const BUNGIE_API_BASE = "https://www.bungie.net/Platform";

export interface BungieConfig {
  apiKey: string;
  clientId: string;
  clientSecret: string | null;
}

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  membership_id: string;
  obtained_at: number;
}

export function loadConfig(): BungieConfig {
  const apiKey = process.env.BUNGIE_API_KEY?.trim();
  const clientId = process.env.BUNGIE_CLIENT_ID?.trim();
  const clientSecret = process.env.BUNGIE_CLIENT_SECRET?.trim() || null;

  if (!apiKey || !clientId) {
    console.error(
      "Missing BUNGIE_API_KEY or BUNGIE_CLIENT_ID. Copy spike/.env.example to spike/.env.local and fill in values from your Bungie app at https://www.bungie.net/en/Application",
    );
    process.exit(1);
  }

  return { apiKey, clientId, clientSecret };
}

export function loadTokens(): StoredTokens | null {
  if (!existsSync(TOKENS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(TOKENS_PATH, "utf8")) as StoredTokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: StoredTokens): void {
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

export function tokensExpired(tokens: StoredTokens, marginSec = 60): boolean {
  const expiresAt = tokens.obtained_at + tokens.expires_in * 1000;
  return Date.now() >= expiresAt - marginSec * 1000;
}
