import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";

export type ArchetypePair = {
  primary: ArmorStatName;
  secondary: ArmorStatName;
};

export function isValidArchetypePair(
  primary: ArmorStatName,
  secondary: ArmorStatName,
): boolean {
  if (primary === secondary) return false;
  return (
    ARMOR_STAT_NAMES.includes(primary) && ARMOR_STAT_NAMES.includes(secondary)
  );
}

export function archetypePairsEqual(
  a: ArchetypePair,
  b: ArchetypePair,
): boolean {
  return a.primary === b.primary && a.secondary === b.secondary;
}
