/**
 * Force Bungie inventory re-derive into inventory_cache for the user who owns
 * the given instance id (default: Speaker's Sight reference helmet).
 *
 * Run:
 *   NODE_OPTIONS='--require ./scripts/stub-server-only.cjs' \
 *   npx tsx --tsconfig tsconfig.json scripts/refresh-inventory-cache.ts [instanceId]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const DEFAULT_HELMET_ID = "6917530125298828509";

async function main(): Promise<void> {
  const targetId = process.argv[2] ?? DEFAULT_HELMET_ID;
  const { getServiceRoleClient } = await import("../src/lib/db/server");
  const { syncUserInventory, getCachedInventory } = await import(
    "../src/lib/inventory/sync"
  );
  type Session = import("../src/lib/auth/session").Session;

  const sb = getServiceRoleClient();
  const { data: cacheRows, error: cacheErr } = await sb
    .from("inventory_cache")
    .select("user_id, items");
  if (cacheErr) throw cacheErr;

  let ownerUserId: string | null = null;
  for (const row of cacheRows ?? []) {
    const items = row.items as Array<{ itemInstanceId?: string }> | null;
    if (!Array.isArray(items)) continue;
    if (items.some((p) => p.itemInstanceId === targetId)) {
      ownerUserId = row.user_id;
      break;
    }
  }
  if (!ownerUserId) {
    throw new Error(`No inventory_cache row contains instance ${targetId}`);
  }

  const { data: user, error: userErr } = await sb
    .from("users")
    .select("id, bungie_membership_id, bungie_membership_type, display_name")
    .eq("id", ownerUserId)
    .maybeSingle();
  if (userErr) throw userErr;
  if (!user) throw new Error(`User ${ownerUserId} not found`);

  const session: Session = {
    userId: user.id,
    bungieMembershipId: user.bungie_membership_id,
    bungieMembershipType: user.bungie_membership_type,
    displayName: user.display_name,
    issuedAt: Math.floor(Date.now() / 1000),
  };

  console.log("Refreshing inventory for", user.display_name, `(${user.id.slice(0, 8)}…)`);
  const result = await syncUserInventory(session, { force: true });
  console.log(JSON.stringify(result, null, 2));

  const helmet = (await getCachedInventory(user.id))?.find(
    (p) => p.itemInstanceId === targetId,
  );
  if (helmet) {
    console.log("helmet statTotals after sync:", helmet.statTotals);
    console.log("helmet tuningDeltas after sync:", helmet.tuningDeltas ?? null);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
