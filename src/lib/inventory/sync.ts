import "server-only";
import { BungieApiError, getProfile } from "@/lib/bungie/client";
import { PROFILE_COMPONENTS } from "@/lib/bungie/constants";
import { withBackoff, withUserRateLimit } from "@/lib/bungie/rate-limit";
import { getServiceRoleClient } from "@/lib/db/server";
import { BUNGIE_REAUTH_USER_MESSAGE } from "@/lib/auth/bungie-reauth";
import {
  forceRefreshAccessToken,
  getValidAccessToken,
} from "@/lib/auth/tokens";
import { getManifestLookups } from "@/lib/manifest/lookups";
import type { Session } from "@/lib/auth/session";
import type { DerivedArmorPieceJson, InventoryCacheRow, Json } from "@/lib/db/types";
import type { ProfileResponse } from "@/lib/bungie/types";
import { deriveAllArmorPieces } from "./derive";

/** Raw item counts from GetProfile — used to detect withheld inventory components. */
function rawInventoryItemCounts(profile: ProfileResponse): {
  profileItems: number;
  characterBagItems: number;
  equippedItems: number;
} {
  const profileItems = profile.profileInventory?.data?.items?.length ?? 0;
  let characterBagItems = 0;
  for (const inv of Object.values(profile.characterInventories?.data ?? {})) {
    characterBagItems += inv.items?.length ?? 0;
  }
  let equippedItems = 0;
  for (const eq of Object.values(profile.characterEquipment?.data ?? {})) {
    equippedItems += eq.items?.length ?? 0;
  }
  return { profileItems, characterBagItems, equippedItems };
}

export const INVENTORY_TTL_MS = 5 * 60 * 1000;

export interface InventorySyncResult {
  syncedAt: string;
  itemCount: number;
  cached: boolean;
  manifestVersion: string | null;
  warnings: string[];
  /**
   * Bungie returned equipment only (vault + character bags empty). Almost always
   * missing `ReadDestinyInventoryAndVault` on the stored token — user must sign
   * out and back in (and confirm the scope on the Bungie app).
   */
  equipmentOnlyRestricted?: boolean;
}

export interface InventorySyncOptions {
  force?: boolean;
}

export class InventoryNotReady extends Error {
  constructor(reason: string, readonly status: number = 503) {
    super(reason);
    this.name = "InventoryNotReady";
  }
}

export async function syncUserInventory(
  session: Session,
  options: InventorySyncOptions = {},
): Promise<InventorySyncResult> {
  const sb = getServiceRoleClient();

  if (!options.force) {
    const { data: existing } = await sb
      .from("inventory_cache")
      .select("user_id, items, synced_at")
      .eq("user_id", session.userId)
      .maybeSingle();
    if (existing) {
      const ageMs = Date.now() - new Date(existing.synced_at).getTime();
      if (ageMs < INVENTORY_TTL_MS) {
        const items = existing.items as DerivedArmorPieceJson[] | null;
        return {
          syncedAt: existing.synced_at,
          itemCount: Array.isArray(items) ? items.length : 0,
          cached: true,
          manifestVersion: null,
          warnings: [],
          equipmentOnlyRestricted: false,
        };
      }
    }
  }

  const accessToken = await getValidAccessToken(session.userId);
  if (!accessToken) {
    throw new InventoryNotReady(BUNGIE_REAUTH_USER_MESSAGE, 401);
  }

  const lookups = await getManifestLookups();
  const warnings: string[] = [];
  if (!lookups.version) {
    warnings.push("Manifest has not been synced yet — run /api/admin/manifest/sync first.");
  }

  const fetchProfile = (token: string) =>
    withUserRateLimit(session.userId, () =>
      withBackoff(
        () =>
          getProfile(
            session.bungieMembershipType,
            session.bungieMembershipId,
            PROFILE_COMPONENTS,
            token,
          ),
        { retries: 2, baseMs: 400 },
      ),
    );

  let profile;
  try {
    profile = await fetchProfile(accessToken);
  } catch (err) {
    if (err instanceof BungieApiError && err.maintenance) {
      throw new InventoryNotReady("Bungie API is in maintenance.", 503);
    }
    // Bungie sometimes revokes a token before our cached `expires_at` says it
    // should be expired (server restarts on their side, user re-auth elsewhere,
    // etc.). Force-refresh once and retry before giving up.
    if (err instanceof BungieApiError && err.status === 401) {
      const refreshed = await forceRefreshAccessToken(session.userId);
      if (!refreshed) {
        throw new InventoryNotReady(BUNGIE_REAUTH_USER_MESSAGE, 401);
      }
      try {
        profile = await fetchProfile(refreshed);
      } catch (retryErr) {
        if (
          retryErr instanceof BungieApiError &&
          retryErr.status === 401
        ) {
          throw new InventoryNotReady(BUNGIE_REAUTH_USER_MESSAGE, 401);
        }
        throw retryErr;
      }
    } else {
      throw err;
    }
  }

  const rawCounts = rawInventoryItemCounts(profile);
  const equipmentOnlyRestricted =
    rawCounts.profileItems === 0 &&
    rawCounts.characterBagItems === 0 &&
    rawCounts.equippedItems > 0;

  if (equipmentOnlyRestricted) {
    warnings.push(
      "Bungie returned equipped armor only (vault and character inventories were empty). " +
        "Reconnect Bungie so your session picks up ReadDestinyInventoryAndVault. " +
        "If it persists, enable that scope on your app at bungie.net/en/Application and check Bungie.net privacy for inventory visibility.",
    );
  }

  const items = deriveAllArmorPieces(profile, lookups);
  const syncedAt = new Date().toISOString();

  const row: InventoryCacheRow = {
    user_id: session.userId,
    items: items as unknown as Json,
    synced_at: syncedAt,
  };

  const { error } = await sb.from("inventory_cache").upsert(row);
  if (error) throw new Error(`Inventory cache upsert failed: ${error.message}`);

  return {
    syncedAt,
    itemCount: items.length,
    cached: false,
    manifestVersion: lookups.version,
    warnings,
    equipmentOnlyRestricted,
  };
}

export async function getCachedInventory(
  userId: string,
): Promise<DerivedArmorPieceJson[] | null> {
  const sb = getServiceRoleClient();
  const { data } = await sb
    .from("inventory_cache")
    .select("items, synced_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return Array.isArray(data.items)
    ? (data.items as unknown as DerivedArmorPieceJson[])
    : null;
}

export async function getCachedInventoryWithSyncedAt(
  userId: string,
): Promise<{ items: DerivedArmorPieceJson[]; syncedAt: string } | null> {
  const sb = getServiceRoleClient();
  const { data } = await sb
    .from("inventory_cache")
    .select("items, synced_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  if (!Array.isArray(data.items)) return null;
  return {
    items: data.items as unknown as DerivedArmorPieceJson[],
    syncedAt: data.synced_at,
  };
}
