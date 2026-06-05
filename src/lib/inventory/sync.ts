import "server-only";
import { BungieApiError, getProfile } from "@/lib/bungie/client";
import { PROFILE_COMPONENTS } from "@/lib/bungie/constants";
import { withBackoff, withUserRateLimit } from "@/lib/bungie/rate-limit";
import { getServiceRoleClient } from "@/lib/db/server";
import { withBungieAccessTokenRetry } from "@/lib/auth/bungie-api-retry";
import { INVENTORY_EQUIPMENT_ONLY_WARNING } from "@/lib/inventory/user-messages";
import { InventoryNotReady } from "@/lib/inventory/inventory-not-ready";
import { getManifestLookups } from "@/lib/manifest/lookups";
import type { Session } from "@/lib/auth/session";
import type { DerivedArmorPieceJson, InventoryCacheRow, Json } from "@/lib/db/types";
import type { ProfileResponse } from "@/lib/bungie/types";
import { deriveAllArmorPieces } from "./derive";
import { listDropFeed, recordNewDropsFromSync } from "./drop-feed";

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
  /** Armor pieces newly detected this sync (empty when `cached` or first-time baseline seed). */
  newPieces?: DerivedArmorPieceJson[];
  feedCount?: number;
}

export interface InventorySyncOptions {
  force?: boolean;
}

export { InventoryNotReady } from "@/lib/inventory/inventory-not-ready";

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
        let feedCount = 0;
        try {
          feedCount = (await listDropFeed(session.userId)).length;
        } catch {
          // Drop-feed tables not migrated yet — inventory cache is still valid.
        }
        return {
          syncedAt: existing.synced_at,
          itemCount: Array.isArray(items) ? items.length : 0,
          cached: true,
          manifestVersion: null,
          warnings: [],
          equipmentOnlyRestricted: false,
          newPieces: [],
          feedCount,
        };
      }
    }
  }

  const lookups = await getManifestLookups();
  const warnings: string[] = [];
  if (!lookups.version) {
    warnings.push(
      "Manifest is still loading — inventory may be incomplete until it finishes.",
    );
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
    profile = await withBungieAccessTokenRetry(session.userId, fetchProfile);
  } catch (err) {
    if (err instanceof BungieApiError && err.maintenance) {
      throw new InventoryNotReady("Bungie API is in maintenance.", 503);
    }
    throw err;
  }

  const rawCounts = rawInventoryItemCounts(profile);
  const equipmentOnlyRestricted =
    rawCounts.profileItems === 0 &&
    rawCounts.characterBagItems === 0 &&
    rawCounts.equippedItems > 0;

  if (equipmentOnlyRestricted) {
    warnings.push(INVENTORY_EQUIPMENT_ONLY_WARNING);
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

  let newPieces: DerivedArmorPieceJson[] = [];
  let feedCount = 0;
  try {
    newPieces = await recordNewDropsFromSync(session.userId, items);
    feedCount = (await listDropFeed(session.userId)).length;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("schema cache") || msg.includes("inventory_seen_instances")) {
      warnings.push(
        "New drops feed is unavailable — run npm run db:push to apply pending migrations.",
      );
    } else {
      throw err;
    }
  }

  return {
    syncedAt,
    itemCount: items.length,
    cached: false,
    manifestVersion: lookups.version,
    warnings,
    equipmentOnlyRestricted,
    newPieces,
    feedCount,
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
