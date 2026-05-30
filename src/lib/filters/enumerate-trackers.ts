import type { TrackerFormSelectors } from "@/lib/views/tracker-form-selectors";
import type { TrackerDescriptor } from "@/lib/workspace/build-tracker-payload-core";
import {
  gridFiltersHaveUnblockingSelection,
  type GridFiltersJson,
} from "@/lib/workspace/grid-filters-schema";

export function enumerateVisibleTrackers(
  filters: GridFiltersJson,
  selectors: TrackerFormSelectors,
): TrackerDescriptor[] {
  if (!gridFiltersHaveUnblockingSelection(filters)) {
    return [];
  }

  const setOptions = selectors.setsByClass[filters.class];
  const setIds =
    filters.setHashes.length > 0 ? new Set(filters.setHashes) : null;
  const archetypeIds =
    filters.archetypeHashes.length > 0
      ? new Set(filters.archetypeHashes)
      : null;
  const tuningIds =
    filters.tuningHashes.length > 0 ? new Set(filters.tuningHashes) : null;
  const searchTerm = filters.search.trim().toLowerCase();

  const sets = setOptions.filter((s) => (setIds ? setIds.has(s.hash) : true));
  const archetypes = selectors.archetypes.filter((a) =>
    archetypeIds ? archetypeIds.has(a.hash) : true,
  );
  const tunings = selectors.tunings.filter((t) =>
    tuningIds ? tuningIds.has(t.hash) : true,
  );

  const out: TrackerDescriptor[] = [];
  for (const set of sets) {
    for (const arch of archetypes) {
      for (const tun of tunings) {
        if (searchTerm) {
          const haystack =
            `${set.name} ${arch.name} ${tun.name}`.toLowerCase();
          if (!haystack.includes(searchTerm)) continue;
        }
        out.push({
          setHash: set.hash,
          archetypeHash: arch.hash,
          tuningHash: tun.hash,
          classType: filters.class,
          setName: set.name,
          archetypeName: arch.name,
          tuningName: tun.name,
        });
      }
    }
  }

  out.sort((a, b) => {
    const s = a.setName.localeCompare(b.setName);
    if (s !== 0) return s;
    const ar = a.archetypeName.localeCompare(b.archetypeName);
    if (ar !== 0) return ar;
    const tu = a.tuningName.localeCompare(b.tuningName);
    if (tu !== 0) return tu;
    return a.setHash - b.setHash;
  });

  return out;
}
