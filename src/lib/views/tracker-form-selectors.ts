import type { TrackerOptionItem } from "@/lib/views/tracker-option";

/** Manifest-backed options for set / archetype / tuning pickers (grid + table). */
export interface TrackerFormSelectors {
  setsByClass: {
    0: TrackerOptionItem[];
    1: TrackerOptionItem[];
    2: TrackerOptionItem[];
  };
  archetypes: TrackerOptionItem[];
  tunings: TrackerOptionItem[];
  manifestEmpty: boolean;
}
