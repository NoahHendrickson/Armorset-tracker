import type {
  ArchetypeRow,
  ArmorItemRow,
  ArmorSetRow,
  TuningRow,
} from "@/lib/db/types";

export const MOCK_ARMOR_SETS: ArmorSetRow[] = [
  {
    set_hash: 1001,
    name: "Iron Will Suit",
    season_id: 27,
    legacy_set_hash: null,
    legacy_set_hashes: null,
  },
  {
    set_hash: 1002,
    name: "Reverie Dawn",
    season_id: 28,
    legacy_set_hash: null,
    legacy_set_hashes: null,
  },
  {
    set_hash: 1003,
    name: "Tundra Pact",
    season_id: 29,
    legacy_set_hash: null,
    legacy_set_hashes: null,
  },
  {
    set_hash: 1004,
    name: "Sunset Marauder",
    season_id: 30,
    legacy_set_hash: null,
    legacy_set_hashes: null,
  },
];

export const MOCK_ARCHETYPES: ArchetypeRow[] = [
  { archetype_hash: 2001, name: "Bulwark" },
  { archetype_hash: 2002, name: "Brawler" },
  { archetype_hash: 2003, name: "Specialist" },
  { archetype_hash: 2004, name: "Paragon" },
  { archetype_hash: 2005, name: "Gunner" },
];

export const MOCK_TUNINGS: TuningRow[] = [
  { tuning_hash: 3001, name: "Tuned: +Weapons / -Grenade" },
  { tuning_hash: 3002, name: "Tuned: +Health / -Super" },
  { tuning_hash: 3003, name: "Tuned: +Class / -Melee" },
  { tuning_hash: 3004, name: "Tuned: +Super / -Health" },
  { tuning_hash: 3005, name: "Tuned: +Melee / -Class" },
];

/** Per-set / per-class armor pieces (5 slots). Icon paths are intentionally omitted to avoid CDN traffic in stories. */
export const MOCK_ARMOR_ITEMS: ArmorItemRow[] = (
  ["helmet", "arms", "chest", "legs", "classItem"] as const
).flatMap((slot) =>
  MOCK_ARMOR_SETS.flatMap((set) =>
    [0, 1, 2].map((classType) => ({
      item_hash: set.set_hash * 100 + classType * 10 + ["helmet", "arms", "chest", "legs", "classItem"].indexOf(slot),
      set_hash: set.set_hash,
      slot,
      class_type: classType,
      icon_path: "",
    })),
  ),
);
