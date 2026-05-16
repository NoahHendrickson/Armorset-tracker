import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import {
  MOCK_ARCHETYPES,
  MOCK_ARMOR_SETS,
  MOCK_TUNINGS,
} from "./manifest-lookups";

/** Lightweight lookup payload for grid stories — names only, no icons. */
export const MOCK_GRID_LOOKUP_PAYLOAD: GridLookupPayload = {
  setNameByHash: Object.fromEntries(
    MOCK_ARMOR_SETS.map((s) => [String(s.set_hash), s.name]),
  ),
  archetypeNameByHash: Object.fromEntries(
    MOCK_ARCHETYPES.map((a) => [String(a.archetype_hash), a.name]),
  ),
  tuningNameByHash: Object.fromEntries(
    MOCK_TUNINGS.map((t) => [String(t.tuning_hash), t.name]),
  ),
  armorSlotIconByKey: {},
  slotFallbackIconByName: {},
  archetypeStatPair: {
    [String(MOCK_ARCHETYPES[0].archetype_hash)]: {
      primary: "Weapons",
      secondary: "Health",
    },
    [String(MOCK_ARCHETYPES[1].archetype_hash)]: {
      primary: "Health",
      secondary: "Class",
    },
    [String(MOCK_ARCHETYPES[2].archetype_hash)]: {
      primary: "Grenade",
      secondary: "Melee",
    },
    [String(MOCK_ARCHETYPES[3].archetype_hash)]: {
      primary: "Super",
      secondary: "Weapons",
    },
    [String(MOCK_ARCHETYPES[4].archetype_hash)]: {
      primary: "Weapons",
      secondary: "Grenade",
    },
  },
  statIconByName: {},
};
