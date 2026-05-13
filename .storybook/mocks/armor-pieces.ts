import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { SLOT_ORDER } from "@/lib/bungie/constants";
import {
  MOCK_ARCHETYPES,
  MOCK_ARMOR_SETS,
  MOCK_TUNINGS,
} from "./manifest-lookups";

const SET = MOCK_ARMOR_SETS[0]!;
const ARCH = MOCK_ARCHETYPES[0]!;
const TUNE = MOCK_TUNINGS[0]!;

const CHAR_TITAN = "char-titan-01";
const CHAR_HUNTER = "char-hunter-01";

function basePiece(
  slot: DerivedArmorPieceJson["slot"],
  index: number,
): Omit<DerivedArmorPieceJson, "tertiaryStat" | "tuningHash" | "tuningName" | "location"> {
  return {
    itemInstanceId: `inst-${slot}-${index}`,
    itemHash: SET.set_hash * 100 + index,
    slot,
    classType: 0,
    setHash: SET.set_hash,
    setName: SET.name,
    archetypeHash: ARCH.archetype_hash,
    archetypeName: ARCH.name,
    primaryStat: "Weapons",
    secondaryStat: "Health",
  };
}

/** Vault piece, fully committed tuning. */
function vaultPiece(
  slot: DerivedArmorPieceJson["slot"],
  index: number,
  tertiary: DerivedArmorPieceJson["tertiaryStat"],
): DerivedArmorPieceJson {
  return {
    ...basePiece(slot, index),
    tuningHash: TUNE.tuning_hash,
    tuningName: TUNE.name,
    tuningCommitted: true,
    tertiaryStat: tertiary,
    location: { kind: "vault" },
  };
}

/** Character-equipped piece, uncommitted tuning. */
function characterPiece(
  slot: DerivedArmorPieceJson["slot"],
  index: number,
  tertiary: DerivedArmorPieceJson["tertiaryStat"],
  characterId: string,
  classType: number,
  equipped: boolean,
): DerivedArmorPieceJson {
  return {
    ...basePiece(slot, index),
    classType,
    tuningHash: TUNE.tuning_hash,
    tuningName: TUNE.name,
    tuningCommitted: false,
    tertiaryStat: tertiary,
    location: {
      kind: "character",
      characterId,
      classType,
      equipped,
    },
  };
}

/**
 * A small but complete inventory: at least one matching piece for the first
 * three slots in the "Class" tertiary, plus duplicates and off-tertiary pieces
 * to exercise the duplicate / mismatch render paths in `ViewGrid`.
 */
export const MOCK_INVENTORY: DerivedArmorPieceJson[] = [
  vaultPiece("helmet", 1, "Class"),
  vaultPiece("helmet", 2, "Class"),
  characterPiece("arms", 3, "Class", CHAR_TITAN, 0, true),
  vaultPiece("chest", 4, "Class"),
  characterPiece("legs", 5, "Melee", CHAR_HUNTER, 1, false),
  vaultPiece("classItem", 6, "Super"),
];

/** Empty inventory — for "loading" / "missing" coverage in stories. */
export const EMPTY_INVENTORY: DerivedArmorPieceJson[] = [];

/** Inventory with at least one match for every (slot × tertiary) cell. */
export const FULL_COVERAGE_INVENTORY: DerivedArmorPieceJson[] = SLOT_ORDER.flatMap(
  (slot, slotIndex) =>
    (["Class", "Melee", "Super", "Grenade"] as const).map((tertiary, statIndex) =>
      vaultPiece(slot, slotIndex * 10 + statIndex, tertiary),
    ),
);
