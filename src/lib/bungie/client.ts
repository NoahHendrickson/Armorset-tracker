import "server-only";
import { BUNGIE_API_BASE } from "./constants";
import { serverEnv } from "@/lib/env";
import type {
  BungieResponse,
  DestinyManifestResponse,
  MembershipData,
  ProfileResponse,
} from "./types";

export class BungieApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode: number | null,
    readonly maintenance: boolean,
  ) {
    super(message);
    this.name = "BungieApiError";
  }
}

const MAINTENANCE_ERROR_CODES = new Set([5, 1641]);

async function bungieGet<T>(
  path: string,
  accessToken?: string,
): Promise<T> {
  const env = serverEnv();
  const url = path.startsWith("http") ? path : `${BUNGIE_API_BASE}${path}`;
  const headers: Record<string, string> = {
    "X-API-Key": env.BUNGIE_API_KEY,
    Accept: "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 503) {
    throw new BungieApiError("Bungie API maintenance", 503, null, true);
  }
  if (!res.ok) {
    throw new BungieApiError(
      `Bungie GET ${path} failed: ${res.status} ${res.statusText}`,
      res.status,
      null,
      false,
    );
  }
  const data = (await res.json()) as BungieResponse<T>;
  if (data.ErrorCode !== 1) {
    throw new BungieApiError(
      `Bungie API error on ${path}: ${data.ErrorStatus} (${data.ErrorCode}) — ${data.Message}`,
      res.status,
      data.ErrorCode,
      MAINTENANCE_ERROR_CODES.has(data.ErrorCode),
    );
  }
  return data.Response;
}

export async function getMembershipDataForCurrentUser(
  accessToken: string,
): Promise<MembershipData> {
  return bungieGet<MembershipData>(
    "/User/GetMembershipsForCurrentUser/",
    accessToken,
  );
}

export async function getProfile(
  membershipType: number,
  membershipId: string,
  components: readonly number[],
  accessToken: string,
): Promise<ProfileResponse> {
  const path = `/Destiny2/${membershipType}/Profile/${membershipId}/?components=${components.join(",")}`;
  return bungieGet<ProfileResponse>(path, accessToken);
}

export async function getDestinyManifest(): Promise<DestinyManifestResponse> {
  return bungieGet<DestinyManifestResponse>("/Destiny2/Manifest/");
}

export async function fetchManifestSlice(path: string): Promise<Record<string, unknown>> {
  const env = serverEnv();
  const res = await fetch(`https://www.bungie.net${path}`, {
    headers: { "X-API-Key": env.BUNGIE_API_KEY },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new BungieApiError(
      `Manifest slice fetch failed: ${res.status} ${res.statusText}`,
      res.status,
      null,
      false,
    );
  }
  return (await res.json()) as Record<string, unknown>;
}
