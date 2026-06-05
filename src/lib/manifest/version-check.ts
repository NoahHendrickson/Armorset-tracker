import "server-only";

import { getDestinyManifest } from "@/lib/bungie/client";
import { getServiceRoleClient } from "@/lib/db/server";
import { optimizerFragmentCatalogComplete } from "@/lib/optimizer/subclass-key";

export interface ManifestVersionCheckResult {
  cachedVersion: string | null;
  liveVersion: string | null;
  needsResync: boolean;
  // True when the manifest version matches but derived tables are missing or
  // stale (e.g. after a schema migration backfill, or optimizer catalog gaps).
  schemaOutdated: boolean;
}

let lastCheckAt = 0;
let lastResult: ManifestVersionCheckResult = {
  cachedVersion: null,
  liveVersion: null,
  needsResync: false,
  schemaOutdated: false,
};
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export async function checkManifestVersion(
  force = false,
): Promise<ManifestVersionCheckResult> {
  const now = Date.now();
  if (
    !force &&
    now - lastCheckAt < CHECK_INTERVAL_MS &&
    !lastResult.schemaOutdated &&
    !lastResult.needsResync
  ) {
    return lastResult;
  }

  const sb = getServiceRoleClient();
  // The live version comes from Bungie (network) and is independent of the
  // Supabase schema-health queries below, so start it now and await it after —
  // it overlaps the queries instead of running sequentially after them.
  const liveVersionPromise = getDestinyManifest()
    .then((manifest) => manifest.version)
    .catch(() => null);
  const [
    cachedRes,
    statPairsRes,
    statPlugsRes,
    statIconsRes,
    armorItemThumbRes,
    fragmentPlugsRes,
    unknownSubclassKeysRes,
    fragmentSubclassKeysRes,
    armorSetsRes,
    setPerksRes,
  ] = await Promise.all([
    sb
      .from("manifest_versions")
      .select("version")
      .eq("is_active", true)
      .maybeSingle(),
    sb.from("archetype_stat_pairs").select("*", { count: "exact", head: true }),
    sb.from("armor_stat_plugs").select("*", { count: "exact", head: true }),
    sb.from("armor_stat_icons").select("*", { count: "exact", head: true }),
    sb
      .from("armor_items")
      .select("*", { count: "exact", head: true })
      .neq("icon_path", ""),
    sb.from("subclass_fragment_plugs").select("*", { count: "exact", head: true }),
    sb
      .from("subclass_fragment_plugs")
      .select("*", { count: "exact", head: true })
      .eq("subclass_key", "unknown"),
    sb.from("subclass_fragment_plugs").select("subclass_key"),
    sb.from("armor_sets").select("*", { count: "exact", head: true }),
    sb.from("armor_set_perks").select("*", { count: "exact", head: true }),
  ]);
  const cachedVersion = cachedRes.data?.version ?? null;
  const statPairsCount = statPairsRes.count ?? 0;
  const statPlugsCount = statPlugsRes.count ?? 0;
  const statIconsCount = statIconsRes.count ?? 0;
  const armorItemThumbCount = armorItemThumbRes.count ?? 0;
  const fragmentPlugsCount = fragmentPlugsRes.count ?? 0;
  const unknownSubclassKeysCount = unknownSubclassKeysRes.count ?? 0;
  const fragmentSubclassKeys = new Set(
    (fragmentSubclassKeysRes.data ?? []).map((row) => row.subclass_key),
  );
  const fragmentCatalogComplete = optimizerFragmentCatalogComplete(
    fragmentSubclassKeys,
    fragmentPlugsCount,
  );
  const armorSetsCount = armorSetsRes.count ?? 0;
  const setPerksCount = setPerksRes.count ?? 0;

  const liveVersion = await liveVersionPromise;

  const versionMismatch =
    liveVersion !== null && cachedVersion !== null && cachedVersion !== liveVersion;
  const schemaOutdated =
    cachedVersion !== null &&
    (statPairsCount === 0 ||
      statPlugsCount === 0 ||
      statIconsCount === 0 ||
      armorItemThumbCount === 0 ||
      fragmentPlugsCount === 0 ||
      !fragmentCatalogComplete ||
      (fragmentPlugsCount > 0 && unknownSubclassKeysCount > 0) ||
      (armorSetsCount > 0 && setPerksCount === 0));

  lastCheckAt = now;
  lastResult = {
    cachedVersion,
    liveVersion,
    needsResync: versionMismatch,
    schemaOutdated,
  };
  return lastResult;
}

export function invalidateManifestVersionCheck() {
  lastCheckAt = 0;
}
