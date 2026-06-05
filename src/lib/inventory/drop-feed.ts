import "server-only";
import { getServiceRoleClient } from "@/lib/db/server";
import type {
  DerivedArmorPieceJson,
  InventoryDropFeedEntry,
  Json,
} from "@/lib/db/types";

export const DROP_FEED_MAX = 50;

const SEEN_UPSERT_CHUNK = 500;

function pieceToRow(
  userId: string,
  piece: DerivedArmorPieceJson,
  firstSeenAt: string,
) {
  return {
    user_id: userId,
    item_instance_id: piece.itemInstanceId,
    first_seen_at: firstSeenAt,
    piece: piece as unknown as Json,
  };
}

async function hasSeenBaseline(userId: string): Promise<boolean> {
  const sb = getServiceRoleClient();
  const { count, error } = await sb
    .from("inventory_seen_instances")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) {
    throw new Error(`inventory_seen_instances count failed: ${error.message}`);
  }
  return (count ?? 0) > 0;
}

async function upsertSeenInstances(
  userId: string,
  pieces: DerivedArmorPieceJson[],
  firstSeenAt: string,
): Promise<void> {
  if (pieces.length === 0) return;
  const sb = getServiceRoleClient();
  for (let i = 0; i < pieces.length; i += SEEN_UPSERT_CHUNK) {
    const chunk = pieces.slice(i, i + SEEN_UPSERT_CHUNK).map((piece) => ({
      user_id: userId,
      item_instance_id: piece.itemInstanceId,
      first_seen_at: firstSeenAt,
    }));
    const { error } = await sb.from("inventory_seen_instances").upsert(chunk, {
      onConflict: "user_id,item_instance_id",
      ignoreDuplicates: true,
    });
    if (error) {
      throw new Error(`inventory_seen_instances upsert failed: ${error.message}`);
    }
  }
}

async function trimDropFeed(userId: string): Promise<void> {
  const sb = getServiceRoleClient();
  const { data, error } = await sb
    .from("inventory_drop_feed")
    .select("item_instance_id")
    .eq("user_id", userId)
    .order("first_seen_at", { ascending: false });
  if (error) {
    throw new Error(`inventory_drop_feed list for trim failed: ${error.message}`);
  }
  const rows = data ?? [];
  if (rows.length <= DROP_FEED_MAX) return;
  const toRemove = rows.slice(DROP_FEED_MAX).map((r) => r.item_instance_id);
  const { error: delError } = await sb
    .from("inventory_drop_feed")
    .delete()
    .eq("user_id", userId)
    .in("item_instance_id", toRemove);
  if (delError) {
    throw new Error(`inventory_drop_feed trim failed: ${delError.message}`);
  }
}

/**
 * First sync after feature enable: record all current instance IDs as seen
 * without populating the drop feed.
 */
export async function seedSeenInstancesIfEmpty(
  userId: string,
  items: DerivedArmorPieceJson[],
): Promise<void> {
  if (await hasSeenBaseline(userId)) return;
  const now = new Date().toISOString();
  await upsertSeenInstances(userId, items, now);
}

/**
 * After a fresh Bungie sync, diff instance IDs and append new armor to the feed.
 */
export async function recordNewDropsFromSync(
  userId: string,
  items: DerivedArmorPieceJson[],
): Promise<DerivedArmorPieceJson[]> {
  if (!(await hasSeenBaseline(userId))) {
    await seedSeenInstancesIfEmpty(userId, items);
    return [];
  }

  const sb = getServiceRoleClient();
  const { data: seenRows, error: seenError } = await sb
    .from("inventory_seen_instances")
    .select("item_instance_id")
    .eq("user_id", userId);
  if (seenError) {
    throw new Error(`inventory_seen_instances select failed: ${seenError.message}`);
  }

  const seenSet = new Set(
    (seenRows ?? []).map((r) => r.item_instance_id),
  );
  const newPieces = items.filter((p) => !seenSet.has(p.itemInstanceId));
  if (newPieces.length === 0) return [];

  const now = new Date().toISOString();
  await upsertSeenInstances(userId, newPieces, now);

  const feedRows = newPieces.map((piece) => pieceToRow(userId, piece, now));
  const { error: feedError } = await sb.from("inventory_drop_feed").upsert(feedRows, {
    onConflict: "user_id,item_instance_id",
  });
  if (feedError) {
    throw new Error(`inventory_drop_feed upsert failed: ${feedError.message}`);
  }

  await trimDropFeed(userId);
  return newPieces;
}

function rowToEntry(row: {
  item_instance_id: string;
  first_seen_at: string;
  piece: Json;
}): InventoryDropFeedEntry {
  return {
    itemInstanceId: row.item_instance_id,
    firstSeenAt: row.first_seen_at,
    piece: row.piece as unknown as DerivedArmorPieceJson,
  };
}

export async function listDropFeed(
  userId: string,
  limit = DROP_FEED_MAX,
): Promise<InventoryDropFeedEntry[]> {
  const sb = getServiceRoleClient();
  const { data, error } = await sb
    .from("inventory_drop_feed")
    .select("item_instance_id, first_seen_at, piece")
    .eq("user_id", userId)
    .order("first_seen_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`inventory_drop_feed list failed: ${error.message}`);
  }
  return (data ?? []).map(rowToEntry);
}

export async function clearDropFeed(userId: string): Promise<void> {
  const sb = getServiceRoleClient();
  const { error } = await sb
    .from("inventory_drop_feed")
    .delete()
    .eq("user_id", userId);
  if (error) {
    throw new Error(`inventory_drop_feed clear failed: ${error.message}`);
  }
}

export async function dismissDropFeedEntry(
  userId: string,
  itemInstanceId: string,
): Promise<void> {
  const sb = getServiceRoleClient();
  const { error } = await sb
    .from("inventory_drop_feed")
    .delete()
    .eq("user_id", userId)
    .eq("item_instance_id", itemInstanceId);
  if (error) {
    throw new Error(`inventory_drop_feed dismiss failed: ${error.message}`);
  }
}
