import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getValidAccessToken } from "@/lib/auth/tokens";
import { getProfile } from "@/lib/bungie/client";
import { ARMOR_BUCKET_TO_SLOT, PROFILE_COMPONENTS } from "@/lib/bungie/constants";
import { getCachedInventory } from "@/lib/inventory/sync";
import { fetchManifestSlice, getDestinyManifest } from "@/lib/bungie/client";
import type {
  ManifestInventoryItemDefinition,
  ManifestSocketCategoryDefinition,
  ManifestSocketTypeDefinition,
} from "@/lib/manifest/types";

export const maxDuration = 60;

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const accessToken = await getValidAccessToken(session.userId);
  if (!accessToken) {
    return NextResponse.json({ error: "No valid access token" }, { status: 401 });
  }

  // Find a piece in cache that has tuning but NO archetype — that's the smoking gun
  const cached = await getCachedInventory(session.userId);
  const target = cached?.find(
    (p) => p.tuningHash !== null && p.archetypeHash === null,
  );

  if (!target) {
    return NextResponse.json({
      error:
        "No piece found that has tuning but missing archetype. Either there's no problem, or the cache is empty — try /api/inventory/sync?force=1 first.",
    });
  }

  const profile = await getProfile(
    session.bungieMembershipType,
    session.bungieMembershipId,
    PROFILE_COMPONENTS,
    accessToken,
  );

  const sockets =
    profile.itemComponents?.sockets?.data?.[target.itemInstanceId]?.sockets ?? [];

  const manifestIndex = await getDestinyManifest();
  const paths = manifestIndex.jsonWorldComponentContentPaths.en;
  const [itemsRaw, socketTypesRaw, socketCatsRaw] = await Promise.all([
    fetchManifestSlice(paths.DestinyInventoryItemDefinition),
    fetchManifestSlice(paths.DestinySocketTypeDefinition),
    fetchManifestSlice(paths.DestinySocketCategoryDefinition),
  ]);
  const items = itemsRaw as Record<string, ManifestInventoryItemDefinition>;
  const socketTypes = socketTypesRaw as Record<string, ManifestSocketTypeDefinition>;
  const socketCats = socketCatsRaw as Record<string, ManifestSocketCategoryDefinition>;

  const itemDef = items[String(target.itemHash)];
  const socketEntries = itemDef?.sockets?.socketEntries ?? [];

  const decoded = sockets.map((s, i) => {
    const entry = socketEntries[i];
    const sType = entry ? socketTypes[String(entry.socketTypeHash)] : undefined;
    const cat = sType ? socketCats[String(sType.socketCategoryHash)] : undefined;
    const plugDef = s.plugHash ? items[String(s.plugHash)] : undefined;
    return {
      socketIndex: i,
      socketTypeHash: entry?.socketTypeHash ?? null,
      categoryHash: sType?.socketCategoryHash ?? null,
      categoryName: cat?.displayProperties?.name ?? null,
      plugHash: s.plugHash ?? null,
      plugName: plugDef?.displayProperties?.name ?? null,
      plugCategoryIdentifier: plugDef?.plug?.plugCategoryIdentifier ?? null,
      isEnabled: s.isEnabled,
      isVisible: s.isVisible,
    };
  });

  return NextResponse.json({
    piece: {
      itemHash: target.itemHash,
      slot: target.slot,
      setName: target.setName,
      tuningName: target.tuningName,
      itemName: itemDef?.displayProperties?.name ?? null,
      bucket: itemDef?.inventory?.bucketTypeHash ?? null,
      isArmor: ARMOR_BUCKET_TO_SLOT[itemDef?.inventory?.bucketTypeHash ?? -1] ?? null,
    },
    sockets: decoded,
  });
}
