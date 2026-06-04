/**
 * Print Bungie ItemStats (304) vs derive output for one exotic instance.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const ID = process.argv[2] ?? "6917530125298828509";

async function main(): Promise<void> {
  type Session = import("../src/lib/auth/session").Session;
  const { getServiceRoleClient } = await import("../src/lib/db/server");
  const { getProfile } = await import("../src/lib/bungie/client");
  const { PROFILE_COMPONENTS } = await import("../src/lib/bungie/constants");
  const { withBungieAccessTokenRetry } = await import("../src/lib/auth/bungie-api-retry");
  const { instanceArmorStatTotals, resolveExoticStatTotals } = await import(
    "../src/lib/inventory/instance-armor-stats"
  );
  const { getManifestLookups } = await import("../src/lib/manifest/lookups");
  const { collectArmorItems, deriveArmorPiece } = await import("../src/lib/inventory/derive");
  const { buildPieceDisplayAndTuning } = await import("../src/lib/inventory/armor-tuning-stats");

  const sb = getServiceRoleClient();
  const { data: cacheRows } = await sb.from("inventory_cache").select("user_id, items");
  let ownerUserId: string | null = null;
  for (const row of cacheRows ?? []) {
    const items = row.items as Array<{ itemInstanceId?: string }> | null;
    if (Array.isArray(items) && items.some((p) => p.itemInstanceId === ID)) {
      ownerUserId = row.user_id;
      break;
    }
  }
  if (!ownerUserId) throw new Error("owner not found");

  const { data: user } = await sb
    .from("users")
    .select("id, bungie_membership_id, bungie_membership_type, display_name")
    .eq("id", ownerUserId)
    .single();
  if (!user) throw new Error("user not found");

  const session: Session = {
    userId: user.id,
    bungieMembershipId: user.bungie_membership_id,
    bungieMembershipType: user.bungie_membership_type,
    displayName: user.display_name,
    issuedAt: 0,
  };

  const profile = await withBungieAccessTokenRetry(session.userId, (token) =>
    getProfile(
      session.bungieMembershipType,
      session.bungieMembershipId,
      PROFILE_COMPONENTS,
      token,
    ),
  );
  const lookups = await getManifestLookups();
  const itemStats = instanceArmorStatTotals(
    ID,
    profile,
    lookups.destinyStatHashToArmorStat,
  );
  console.log("ItemStats (304):", itemStats);

  const entries = collectArmorItems(profile, lookups);
  const entry = entries.find((e) => e.item.itemInstanceId === ID);
  if (!entry) {
    console.log("armor entry not found in profile");
    return;
  }
  const derived = deriveArmorPiece(entry, profile, lookups);
  console.log("derive statTotals:", derived?.statTotals);
  console.log("derive tuningDeltas:", derived?.tuningDeltas ?? null);

  const budget =
    lookups.exoticStatBudgetByItemHash.get(entry.item.itemHash) ?? null;
  console.log("manifest exotic budget:", budget);

  const block = profile.itemComponents?.stats?.data?.[ID];
  console.log("has stats component:", Boolean(block?.stats));
  if (block?.stats) {
    console.log(
      "raw stat entries:",
      Object.values(block.stats).map((s) => ({
        statHash: s.statHash,
        value: s.value,
      })),
    );
  }

  const sockets =
    profile.itemComponents?.sockets?.data?.[ID]?.sockets ?? [];
  const statPlugs: Array<{ stat: string; value: number }> = [];
  for (const socket of sockets) {
    if (!socket.plugHash) continue;
    const stat = lookups.statPlug.get(socket.plugHash);
    if (stat) statPlugs.push(stat);
  }
  console.log("socket stat plugs:", statPlugs);
  const plugOnly = buildPieceDisplayAndTuning(statPlugs, [], null).statTotals;
  console.log("plug-only display:", plugOnly);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
