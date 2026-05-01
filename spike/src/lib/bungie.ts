import { BUNGIE_API_BASE, type BungieConfig, type StoredTokens } from "./config.js";

interface BungieResponse<T> {
  Response: T;
  ErrorCode: number;
  ThrottleSeconds: number;
  ErrorStatus: string;
  Message: string;
}

export async function bungieGet<T>(
  path: string,
  config: BungieConfig,
  tokens: StoredTokens | null = null,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${BUNGIE_API_BASE}${path}`;
  const headers: Record<string, string> = {
    "X-API-Key": config.apiKey,
    Accept: "application/json",
  };
  if (tokens) {
    headers.Authorization = `Bearer ${tokens.access_token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bungie GET ${path} failed: ${res.status} ${res.statusText}\n${body}`);
  }

  const data = (await res.json()) as BungieResponse<T>;
  if (data.ErrorCode !== 1) {
    throw new Error(`Bungie API error on ${path}: ${data.ErrorStatus} (${data.ErrorCode}) — ${data.Message}`);
  }
  return data.Response;
}

export interface MembershipData {
  bungieNetUser: { membershipId: string; displayName: string };
  destinyMemberships: Array<{
    membershipId: string;
    membershipType: number;
    displayName: string;
    crossSaveOverride: number;
    applicableMembershipTypes: number[];
  }>;
  primaryMembershipId?: string;
}

export async function getMembershipDataForCurrentUser(
  config: BungieConfig,
  tokens: StoredTokens,
): Promise<MembershipData> {
  return bungieGet<MembershipData>("/User/GetMembershipsForCurrentUser/", config, tokens);
}

export interface ProfileResponse {
  profile?: { data: { userInfo: { membershipId: string; membershipType: number } } };
  characters?: { data: Record<string, CharacterComponent> };
  characterInventories?: { data: Record<string, { items: ItemComponent[] }> };
  characterEquipment?: { data: Record<string, { items: ItemComponent[] }> };
  profileInventory?: { data: { items: ItemComponent[] } };
  itemComponents?: {
    instances?: { data: Record<string, ItemInstanceComponent> };
    sockets?: { data: Record<string, { sockets: ItemSocketState[] }> };
    stats?: { data: Record<string, { stats: Record<string, { statHash: number; value: number }> }> };
  };
}

export interface CharacterComponent {
  characterId: string;
  classType: number;
  classHash: number;
  light: number;
}

export interface ItemComponent {
  itemHash: number;
  itemInstanceId?: string;
  quantity: number;
  bucketHash: number;
  location: number;
  transferStatus: number;
  isWrapper?: boolean;
  bindStatus: number;
  state: number;
  versionNumber?: number;
  overrideStyleItemHash?: number;
}

export interface ItemInstanceComponent {
  damageType: number;
  primaryStat?: { statHash: number; value: number };
  itemLevel: number;
  quality: number;
  isEquipped: boolean;
  canEquip: boolean;
  energy?: { energyType: number; energyCapacity: number; energyUsed: number; energyUnused: number };
}

export interface ItemSocketState {
  plugHash?: number;
  isEnabled: boolean;
  isVisible: boolean;
  enableFailIndexes?: number[];
}

export async function getProfile(
  membershipType: number,
  membershipId: string,
  components: number[],
  config: BungieConfig,
  tokens: StoredTokens,
): Promise<ProfileResponse> {
  const path = `/Destiny2/${membershipType}/Profile/${membershipId}/?components=${components.join(",")}`;
  return bungieGet<ProfileResponse>(path, config, tokens);
}

export interface ManifestResponse {
  version: string;
  jsonWorldComponentContentPaths: Record<string, Record<string, string>>;
}

export async function getDestinyManifest(config: BungieConfig): Promise<ManifestResponse> {
  return bungieGet<ManifestResponse>("/Destiny2/Manifest/", config);
}

export async function refreshAccessToken(
  config: BungieConfig,
  refreshToken: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  membership_id: string;
}> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
  });
  if (config.clientSecret) body.set("client_secret", config.clientSecret);

  const res = await fetch("https://www.bungie.net/Platform/App/OAuth/Token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-API-Key": config.apiKey,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Refresh failed: ${res.status} ${res.statusText}\n${await res.text()}`);
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_expires_in: number;
    membership_id: string;
  };
}
