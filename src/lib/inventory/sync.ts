import "server-only";
import { BungieApiError, getProfile } from "@/lib/bungie/client";
import { PROFILE_COMPONENTS } from "@/lib/bungie/constants";
import { withBackoff, withUserRateLimit } from "@/lib/bungie/rate-limit";
import { getServiceRoleClient } from "@/lib/db/server";
import { getValidAccessToken } from "@/lib/auth/tokens";
import { getManifestLookups } from "@/lib/manifest/lookups";
import type { Session } from "@/lib/auth/session";
import type { DerivedArmorPieceJson, InventoryCacheRow, Json } from "@/lib/db/types";
import { deriveAllArmorPieces } from "./derive";

export const INVENTORY_TTL_MS = 5 * 60 * 1000;

export interface InventorySyncResult {
  syncedAt: string;
  itemCount: number;
  cached: boolean;
  manifestVersion: string | null;
  warnings: string[];
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
        };
      }
    }
  }

  const accessToken = await getValidAccessToken(session.userId);
  if (!accessToken) {
    throw new InventoryNotReady(
      "Bungie session expired — please sign in again.",
      401,
    );
  }

  const lookups = await getManifestLookups();
  const warnings: string[] = [];
  if (!lookups.version) {
    warnings.push("Manifest has not been synced yet — run /api/admin/manifest/sync first.");
  }

  let profile;
  try {
    profile = await withUserRateLimit(session.userId, () =>
      withBackoff(
        () =>
          getProfile(
            session.bungieMembershipType,
            session.bungieMembershipId,
            PROFILE_COMPONENTS,
            accessToken,
          ),
        { retries: 2, baseMs: 400 },
      ),
    );
  } catch (err) {
    if (err instanceof BungieApiError && err.maintenance) {
      throw new InventoryNotReady("Bungie API is in maintenance.", 503);
    }
    throw err;
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
