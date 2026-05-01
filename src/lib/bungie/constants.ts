export const BUNGIE_AUTH_URL = "https://www.bungie.net/en/OAuth/Authorize";
export const BUNGIE_TOKEN_URL = "https://www.bungie.net/Platform/App/OAuth/Token/";
export const BUNGIE_API_BASE = "https://www.bungie.net/Platform";

export const PROFILE_COMPONENTS = [100, 102, 200, 201, 205, 300, 305] as const;

export const ARMOR_BUCKET_HASHES = {
  helmet: 3448274439,
  arms: 3551918588,
  chest: 14239492,
  legs: 20886954,
  classItem: 1585787867,
} as const;

export type ArmorSlot = keyof typeof ARMOR_BUCKET_HASHES;

export const ARMOR_BUCKET_TO_SLOT: Record<number, ArmorSlot> = Object.entries(
  ARMOR_BUCKET_HASHES,
).reduce<Record<number, ArmorSlot>>((acc, [slot, hash]) => {
  acc[hash] = slot as ArmorSlot;
  return acc;
}, {});

export const ALL_ARMOR_BUCKET_HASHES: readonly number[] = Object.values(
  ARMOR_BUCKET_HASHES,
);

export const SLOT_LABELS: Record<ArmorSlot, string> = {
  helmet: "Helmet",
  arms: "Arms",
  chest: "Chest",
  legs: "Legs",
  classItem: "Class Item",
};

export const SLOT_ORDER: ArmorSlot[] = ["helmet", "arms", "chest", "legs", "classItem"];

export const CLASS_NAMES: Record<number, string> = {
  0: "Titan",
  1: "Hunter",
  2: "Warlock",
  3: "Unknown",
};

export const SOCKET_CATEGORY_KEYWORDS = {
  archetype: ["archetype"],
  tuning: ["tuning", "tertiary"],
} as const;
