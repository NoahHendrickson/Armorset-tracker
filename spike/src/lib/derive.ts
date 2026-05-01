import type {
  ItemComponent,
  ItemSocketState,
  ProfileResponse,
} from "./bungie.js";
import type {
  InventoryItemDefinition,
  ManifestSlices,
  SocketCategoryDefinition,
  SocketTypeDefinition,
} from "./manifest.js";

export type ArmorSlot = "helmet" | "arms" | "chest" | "legs" | "classItem";

export const ARMOR_BUCKET_HASHES: Record<ArmorSlot, number> = {
  helmet: 3448274439,
  arms: 3551918588,
  chest: 14239492,
  legs: 20886954,
  classItem: 1585787867,
};

const ARMOR_BUCKET_TO_SLOT: Record<number, ArmorSlot> = Object.entries(
  ARMOR_BUCKET_HASHES,
).reduce<Record<number, ArmorSlot>>((acc, [slot, hash]) => {
  acc[hash] = slot as ArmorSlot;
  return acc;
}, {});

export interface DerivedArmorPiece {
  itemInstanceId: string;
  itemHash: number;
  slot: ArmorSlot;
  classType: number | null;
  setName: string | null;
  archetypeName: string | null;
  archetypeHash: number | null;
  tuningName: string | null;
  tuningHash: number | null;
  collectibleHash: number | null;
  location: ItemLocation;
  diagnostics: SocketDiagnostic[];
}

export type ItemLocation =
  | { kind: "vault" }
  | { kind: "character"; characterId: string; classType: number; equipped: boolean };

export interface SocketDiagnostic {
  socketIndex: number;
  socketTypeHash: number;
  socketCategoryHash: number | null;
  categoryName: string | null;
  plugHash: number | null;
  plugName: string | null;
  plugCategoryIdentifier: string | null;
  isEnabled: boolean;
  isVisible: boolean;
}

export function isArmorPiece(item: ItemComponent, manifest: ManifestSlices): boolean {
  const def = manifest.items[item.itemHash];
  if (!def) return false;
  const slot = ARMOR_BUCKET_TO_SLOT[def.inventory?.bucketTypeHash ?? -1];
  return slot !== undefined;
}

export interface CategoryHeuristics {
  archetypeCategoryHashes: Set<number>;
  tuningCategoryHashes: Set<number>;
  archetypeKeywords: string[];
  tuningKeywords: string[];
}

export const DEFAULT_HEURISTICS: CategoryHeuristics = {
  archetypeCategoryHashes: new Set<number>(),
  tuningCategoryHashes: new Set<number>(),
  archetypeKeywords: ["archetype"],
  tuningKeywords: ["tuning", "tertiary"],
};

function categoryNameMatchesAny(name: string | undefined, keywords: string[]): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

export function classifySocket(
  socketEntryHash: number,
  socket: ItemSocketState,
  manifest: ManifestSlices,
  heuristics: CategoryHeuristics,
  socketIndex: number,
): SocketDiagnostic {
  const socketType = manifest.socketTypes[socketEntryHash];
  const socketCategoryHash = socketType?.socketCategoryHash ?? null;
  const category = socketCategoryHash
    ? manifest.socketCategories[socketCategoryHash]
    : null;
  const plugDef = socket.plugHash ? manifest.items[socket.plugHash] : null;

  return {
    socketIndex,
    socketTypeHash: socketEntryHash,
    socketCategoryHash,
    categoryName: category?.displayProperties?.name ?? null,
    plugHash: socket.plugHash ?? null,
    plugName: plugDef?.displayProperties?.name ?? null,
    plugCategoryIdentifier: plugDef?.plug?.plugCategoryIdentifier ?? null,
    isEnabled: socket.isEnabled,
    isVisible: socket.isVisible,
  };
}

function isArchetypeCategory(
  diag: SocketDiagnostic,
  manifest: ManifestSlices,
  heuristics: CategoryHeuristics,
): boolean {
  if (diag.socketCategoryHash === null) return false;
  if (heuristics.archetypeCategoryHashes.has(diag.socketCategoryHash)) return true;
  const cat = manifest.socketCategories[diag.socketCategoryHash];
  if (categoryNameMatchesAny(cat?.displayProperties?.name, heuristics.archetypeKeywords)) {
    heuristics.archetypeCategoryHashes.add(diag.socketCategoryHash);
    return true;
  }
  if (
    diag.plugCategoryIdentifier &&
    diag.plugCategoryIdentifier.toLowerCase().includes("archetype")
  ) {
    heuristics.archetypeCategoryHashes.add(diag.socketCategoryHash);
    return true;
  }
  return false;
}

function isTuningCategory(
  diag: SocketDiagnostic,
  manifest: ManifestSlices,
  heuristics: CategoryHeuristics,
): boolean {
  if (diag.socketCategoryHash === null) return false;
  if (heuristics.tuningCategoryHashes.has(diag.socketCategoryHash)) return true;
  const cat = manifest.socketCategories[diag.socketCategoryHash];
  if (categoryNameMatchesAny(cat?.displayProperties?.name, heuristics.tuningKeywords)) {
    heuristics.tuningCategoryHashes.add(diag.socketCategoryHash);
    return true;
  }
  if (
    diag.plugCategoryIdentifier &&
    (diag.plugCategoryIdentifier.toLowerCase().includes("tuning") ||
      diag.plugCategoryIdentifier.toLowerCase().includes("tertiary"))
  ) {
    heuristics.tuningCategoryHashes.add(diag.socketCategoryHash);
    return true;
  }
  return false;
}

export function deriveSetName(
  itemDef: InventoryItemDefinition,
  manifest: ManifestSlices,
): string | null {
  if (!itemDef.collectibleHash) return null;
  const collectible = manifest.collectibles[itemDef.collectibleHash];
  return collectible?.displayProperties?.name ?? null;
}

export function deriveArmorPiece(
  item: ItemComponent,
  location: ItemLocation,
  manifest: ManifestSlices,
  profile: ProfileResponse,
  heuristics: CategoryHeuristics,
): DerivedArmorPiece | null {
  if (!item.itemInstanceId) return null;
  const itemDef = manifest.items[item.itemHash];
  if (!itemDef) return null;
  const slot = ARMOR_BUCKET_TO_SLOT[itemDef.inventory?.bucketTypeHash ?? -1];
  if (!slot) return null;

  const sockets =
    profile.itemComponents?.sockets?.data?.[item.itemInstanceId]?.sockets ?? [];
  const socketEntries = itemDef.sockets?.socketEntries ?? [];

  const diagnostics: SocketDiagnostic[] = sockets.map((s, i) => {
    const entry = socketEntries[i];
    const socketTypeHash = entry?.socketTypeHash ?? 0;
    return classifySocket(socketTypeHash, s, manifest, heuristics, i);
  });

  let archetypeName: string | null = null;
  let archetypeHash: number | null = null;
  let tuningName: string | null = null;
  let tuningHash: number | null = null;

  for (const diag of diagnostics) {
    if (!diag.plugHash || !diag.plugName) continue;
    if (!archetypeHash && isArchetypeCategory(diag, manifest, heuristics)) {
      archetypeName = diag.plugName;
      archetypeHash = diag.plugHash;
      continue;
    }
    if (!tuningHash && isTuningCategory(diag, manifest, heuristics)) {
      tuningName = diag.plugName;
      tuningHash = diag.plugHash;
    }
  }

  return {
    itemInstanceId: item.itemInstanceId,
    itemHash: item.itemHash,
    slot,
    classType: itemDef.classType ?? null,
    setName: deriveSetName(itemDef, manifest),
    archetypeName,
    archetypeHash,
    tuningName,
    tuningHash,
    collectibleHash: itemDef.collectibleHash ?? null,
    location,
    diagnostics,
  };
}

export function collectAllArmorItems(profile: ProfileResponse): Array<{
  item: ItemComponent;
  location: ItemLocation;
}> {
  const out: Array<{ item: ItemComponent; location: ItemLocation }> = [];

  const vault = profile.profileInventory?.data?.items ?? [];
  for (const item of vault) {
    if (Object.values(ARMOR_BUCKET_HASHES).includes(item.bucketHash)) {
      out.push({ item, location: { kind: "vault" } });
    }
  }

  const charInv = profile.characterInventories?.data ?? {};
  const characters = profile.characters?.data ?? {};
  for (const [characterId, inv] of Object.entries(charInv)) {
    const cls = characters[characterId]?.classType ?? -1;
    for (const item of inv.items) {
      if (Object.values(ARMOR_BUCKET_HASHES).includes(item.bucketHash)) {
        out.push({
          item,
          location: { kind: "character", characterId, classType: cls, equipped: false },
        });
      }
    }
  }

  const charEquip = profile.characterEquipment?.data ?? {};
  for (const [characterId, eq] of Object.entries(charEquip)) {
    const cls = characters[characterId]?.classType ?? -1;
    for (const item of eq.items) {
      if (Object.values(ARMOR_BUCKET_HASHES).includes(item.bucketHash)) {
        out.push({
          item,
          location: { kind: "character", characterId, classType: cls, equipped: true },
        });
      }
    }
  }

  return out;
}
