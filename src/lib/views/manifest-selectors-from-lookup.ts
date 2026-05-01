import "server-only";
import type { ManifestLookups } from "@/lib/manifest/lookups";
import type { TrackerOptionItem } from "@/lib/views/tracker-option";
export function manifestSelectorsFromLookups(lookups: ManifestLookups): {
  setsByClass: { 0: TrackerOptionItem[]; 1: TrackerOptionItem[]; 2: TrackerOptionItem[] };
  archetypes: TrackerOptionItem[];
  tunings: TrackerOptionItem[];
  manifestEmpty: boolean;
} {
  const setsForClass: Record<0 | 1 | 2, Set<number>> = {
    0: new Set(),
    1: new Set(),
    2: new Set(),
  };
  for (const info of lookups.armorItemByHash.values()) {
    if (info.classType === 0 || info.classType === 1 || info.classType === 2) {
      setsForClass[info.classType].add(info.setHash);
    }
  }

  const allSets = [...lookups.setNameByHash.entries()]
    .map(([hash, name]) => ({ hash, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const setsByClass = {
    0: allSets.filter((s) => setsForClass[0].has(s.hash)),
    1: allSets.filter((s) => setsForClass[1].has(s.hash)),
    2: allSets.filter((s) => setsForClass[2].has(s.hash)),
  };

  const archetypes = [...lookups.archetypeNameByHash.entries()].map(
    ([hash, name]) => ({ hash, name }),
  );
  const tunings = [...lookups.tuningNameByHash.entries()].map(
    ([hash, name]) => ({ hash, name }),
  );

  const manifestEmpty =
    allSets.length === 0 || archetypes.length === 0 || tunings.length === 0;

  return { setsByClass, archetypes, tunings, manifestEmpty };
}
