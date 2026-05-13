import type { TrackerOptionItem } from "@/lib/views/tracker-option";
import type { TrackerFormSelectors } from "@/components/workspace/new-tracker-dialog";
import {
  MOCK_ARCHETYPES,
  MOCK_ARMOR_SETS,
  MOCK_TUNINGS,
} from "./manifest-lookups";

export const MOCK_SET_OPTIONS: TrackerOptionItem[] = MOCK_ARMOR_SETS.map((s) => ({
  hash: s.set_hash,
  name: s.name,
}));

export const MOCK_ARCHETYPE_OPTIONS: TrackerOptionItem[] = MOCK_ARCHETYPES.map(
  (a) => ({
    hash: a.archetype_hash,
    name: a.name,
  }),
);

export const MOCK_TUNING_OPTIONS: TrackerOptionItem[] = MOCK_TUNINGS.map((t) => ({
  hash: t.tuning_hash,
  name: t.name,
}));

export const MOCK_TRACKER_FORM_SELECTORS: TrackerFormSelectors = {
  setsByClass: {
    0: MOCK_SET_OPTIONS,
    1: MOCK_SET_OPTIONS,
    2: MOCK_SET_OPTIONS,
  },
  archetypes: MOCK_ARCHETYPE_OPTIONS,
  tunings: MOCK_TUNING_OPTIONS,
  manifestEmpty: false,
};
