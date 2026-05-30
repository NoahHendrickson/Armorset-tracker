/** Keep in sync with {@link INVENTORY_TTL_MS} in sync.ts. */
const INVENTORY_TTL_MS = 5 * 60 * 1000;

/** True when there is no cache row or the cached inventory is past TTL. */
export function inventoryCacheNeedsSync(
  syncedAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!syncedAt) return true;
  const ageMs = now - new Date(syncedAt).getTime();
  return ageMs >= INVENTORY_TTL_MS;
}
