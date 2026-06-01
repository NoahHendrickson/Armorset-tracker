import type { ProfileResponse } from "@/lib/bungie/types";
import type { ArmorStatName } from "@/lib/db/types";

/** Bungie profile component 304 — per-instance stat block on armor. */
export function instanceArmorStatTotals(
  itemInstanceId: string,
  profile: ProfileResponse,
  destinyStatHashToArmorStat: Map<number, ArmorStatName>,
): Partial<Record<ArmorStatName, number>> | null {
  const block = profile.itemComponents?.stats?.data?.[itemInstanceId]?.stats;
  if (!block) return null;

  const totals: Partial<Record<ArmorStatName, number>> = {};
  for (const entry of Object.values(block)) {
    const stat = destinyStatHashToArmorStat.get(entry.statHash);
    if (!stat) continue;
    totals[stat] = entry.value;
  }

  return Object.keys(totals).length > 0 ? totals : null;
}
