import { buildDestinyStatHashToArmorStat } from "@/lib/inventory/armor-stat-destiny-hashes";
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

  const hashToStat =
    destinyStatHashToArmorStat.size > 0
      ? destinyStatHashToArmorStat
      : buildDestinyStatHashToArmorStat();

  const totals: Partial<Record<ArmorStatName, number>> = {};
  for (const entry of Object.values(block)) {
    const stat = hashToStat.get(entry.statHash);
    if (!stat) continue;
    totals[stat] = entry.value;
  }

  return Object.keys(totals).length > 0 ? totals : null;
}

/**
 * Merge Bungie ItemStats (304) into plug-derived exotic display stats.
 * Full ItemStats replacement breaks valid rolls (e.g. Weapons 25 on Speaker's
 * Sight); we keep plug Weapons and use instance stats to fill gaps and correct
 * inflated secondary stats (e.g. Grenade 12 → 4).
 */
export function mergeExoticInstanceStatTotals(
  plugDerived: Partial<Record<ArmorStatName, number>>,
  instanceTotals: Partial<Record<ArmorStatName, number>>,
): Partial<Record<ArmorStatName, number>> {
  const merged = { ...plugDerived };
  for (const stat of Object.keys(instanceTotals) as ArmorStatName[]) {
    const plugVal = plugDerived[stat];
    const instVal = instanceTotals[stat];
    if (instVal === undefined) continue;
    if (plugVal === undefined) {
      merged[stat] = instVal;
      continue;
    }
    if (stat === "Weapons") {
      continue;
    }
    if (instVal !== undefined) {
      merged[stat] = Math.min(plugVal, instVal);
    }
  }
  return merged;
}

/**
 * For exotics, merge ItemStats (304) into plug/socket display totals when present.
 */
export function resolveExoticStatTotals(
  isExotic: boolean,
  itemInstanceId: string,
  profile: ProfileResponse,
  plugDerivedTotals: Partial<Record<ArmorStatName, number>>,
  destinyStatHashToArmorStat: Map<number, ArmorStatName>,
): Partial<Record<ArmorStatName, number>> {
  if (!isExotic) {
    return plugDerivedTotals;
  }
  const fromInstance = instanceArmorStatTotals(
    itemInstanceId,
    profile,
    destinyStatHashToArmorStat,
  );
  if (fromInstance && Object.keys(fromInstance).length > 0) {
    return mergeExoticInstanceStatTotals(plugDerivedTotals, fromInstance);
  }
  return plugDerivedTotals;
}

/** Subtract slotted general / artifice stat mods from ItemStats (304) totals. */
export function stripSlottedStatMods(
  totals: Partial<Record<ArmorStatName, number>>,
  sockets: Array<{ plugHash?: number }>,
  statModPlugStats: Map<number, Array<{ stat: ArmorStatName; value: number }>>,
): Partial<Record<ArmorStatName, number>> {
  const out = { ...totals };
  for (const socket of sockets) {
    if (!socket.plugHash) continue;
    const deltas = statModPlugStats.get(socket.plugHash);
    if (!deltas) continue;
    for (const { stat, value } of deltas) {
      out[stat] = Math.max(0, (out[stat] ?? 0) - value);
    }
  }
  return out;
}
