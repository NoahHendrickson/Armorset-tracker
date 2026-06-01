import {
  ARMOR_STAT_NAMES,
  type ArmorStatName,
} from "@/lib/db/types";
import type { OptimizerLookupPayload } from "@/lib/views/optimizer-lookup-payload";

/** -10 class-ability stat; only one of the three penalties applies per class. */
const CLASS_CONDITIONAL_FRAGMENT_HASHES = new Set<number>([
  2272984671, // Echo of Persistence
  1727069360, // Spark of Focus
]);

const CLASS_ABILITY_PENALTY_STAT: Record<number, ArmorStatName> = {
  0: "Health",
  1: "Weapons",
  2: "Class",
};

export function computeFragmentStatOffset(
  plugHashes: number[],
  lookup: OptimizerLookupPayload,
  classType?: number,
): Record<ArmorStatName, number> {
  const totals = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, 0]),
  ) as Record<ArmorStatName, number>;

  for (const hash of plugHashes) {
    const plug = lookup.fragmentPlugsByHash[String(hash)];
    if (!plug) continue;
    const classConditional =
      CLASS_CONDITIONAL_FRAGMENT_HASHES.has(hash) && classType !== undefined;
    const penaltyStat = classConditional
      ? CLASS_ABILITY_PENALTY_STAT[classType]
      : undefined;
    for (const delta of plug.deltas) {
      if (classConditional && delta.stat !== penaltyStat) continue;
      totals[delta.stat] = (totals[delta.stat] ?? 0) + delta.value;
    }
  }
  return totals;
}

export function addStatOffsets(
  base: Record<ArmorStatName, number>,
  offset: Record<ArmorStatName, number>,
): Record<ArmorStatName, number> {
  const out = { ...base };
  for (const stat of ARMOR_STAT_NAMES) {
    out[stat] = (base[stat] ?? 0) + (offset[stat] ?? 0);
  }
  return out;
}
