import "server-only";

import { getDestinyManifest } from "@/lib/bungie/client";
import { getServiceRoleClient } from "@/lib/db/server";

interface CheckResult {
  cachedVersion: string | null;
  liveVersion: string | null;
  needsResync: boolean;
  // True when the manifest version matches but a newly-added derived table is
  // empty. Happens after a schema migration adds tables: the manifest is
  // already "synced" but the new tables haven't been backfilled yet.
  schemaOutdated: boolean;
}

let lastCheckAt = 0;
let lastResult: CheckResult = {
  cachedVersion: null,
  liveVersion: null,
  needsResync: false,
  schemaOutdated: false,
};
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export async function checkManifestVersion(force = false): Promise<CheckResult> {
  const now = Date.now();
  if (!force && now - lastCheckAt < CHECK_INTERVAL_MS) {
    return lastResult;
  }

  const sb = getServiceRoleClient();
  const [
    cachedRes,
    statPairsRes,
    statPlugsRes,
    statIconsRes,
    armorItemThumbRes,
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
  ]);
  const cachedVersion = cachedRes.data?.version ?? null;
  const statPairsCount = statPairsRes.count ?? 0;
  const statPlugsCount = statPlugsRes.count ?? 0;
  const statIconsCount = statIconsRes.count ?? 0;
  const armorItemThumbCount = armorItemThumbRes.count ?? 0;

  let liveVersion: string | null = null;
  try {
    const manifest = await getDestinyManifest();
    liveVersion = manifest.version;
  } catch {
    liveVersion = null;
  }

  const versionMismatch =
    liveVersion !== null && cachedVersion !== null && cachedVersion !== liveVersion;
  const schemaOutdated =
    cachedVersion !== null &&
    (statPairsCount === 0 ||
      statPlugsCount === 0 ||
      statIconsCount === 0 ||
      armorItemThumbCount === 0);

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
