import "server-only";
import {
  ARMOR_BUCKET_TO_SLOT,
  type ArmorSlot,
} from "@/lib/bungie/constants";
import type { ItemComponent, ProfileResponse } from "@/lib/bungie/types";
import type { ManifestLookups } from "@/lib/manifest/lookups";
import type {
  ArmorStatName,
  DerivedArmorPieceJson,
  ItemLocationJson,
} from "@/lib/db/types";

interface ItemEntry {
  item: ItemComponent;
  location: ItemLocationJson;
}

// Items in a character's inventory/equipment expose their equipment-slot
// bucketHash (helmet/arms/...). Items in the vault expose the *vault* bucket
// hash (138197802) and lose their equipment slot, so we fall back to the
// manifest's `armor_items` lookup to recognize those as armor.
function isArmor(item: ItemComponent, lookups: ManifestLookups): boolean {
  if (ARMOR_BUCKET_TO_SLOT[item.bucketHash]) return true;
  return lookups.armorItemByHash.has(item.itemHash);
}

export function collectArmorItems(
  profile: ProfileResponse,
  lookups: ManifestLookups,
): ItemEntry[] {
  const out: ItemEntry[] = [];

  const characters = profile.characters?.data ?? {};

  const vault = profile.profileInventory?.data?.items ?? [];
  for (const item of vault) {
    if (isArmor(item, lookups)) {
      out.push({ item, location: { kind: "vault" } });
    }
  }

  const charInv = profile.characterInventories?.data ?? {};
  for (const [characterId, inv] of Object.entries(charInv)) {
    const cls = characters[characterId]?.classType ?? -1;
    for (const item of inv.items) {
      if (isArmor(item, lookups)) {
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
      if (isArmor(item, lookups)) {
        out.push({
          item,
          location: { kind: "character", characterId, classType: cls, equipped: true },
        });
      }
    }
  }

  return out;
}

export function deriveArmorPiece(
  entry: ItemEntry,
  profile: ProfileResponse,
  lookups: ManifestLookups,
): DerivedArmorPieceJson | null {
  const { item, location } = entry;
  if (!item.itemInstanceId) return null;

  const armorItem = lookups.armorItemByHash.get(item.itemHash);
  // Equipment-slot bucketHash works for character inv/equipment; vault items
  // need the manifest fallback since their bucketHash is the vault bucket.
  const slot: ArmorSlot | undefined =
    ARMOR_BUCKET_TO_SLOT[item.bucketHash] ?? armorItem?.slot;
  if (!slot) return null;

  const setHash = armorItem?.setHash ?? null;
  const setName = setHash !== null ? lookups.setNameByHash.get(setHash) ?? null : null;
  const classType = armorItem?.classType ?? null;

  const sockets =
    profile.itemComponents?.sockets?.data?.[item.itemInstanceId]?.sockets ?? [];
  const reusablePlugs =
    profile.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]?.plugs ??
    {};

  let archetypeHash: number | null = null;
  let archetypeName: string | null = null;
  let tuningHash: number | null = null;
  let tuningName: string | null = null;
  let tuningCommitted = false;
  // Armor 3.0 pieces have 3 hidden "armor_stats" plugs whose magnitudes (+30 /
  // +25 / +20 for Tier 5) determine the primary / secondary / tertiary stat.
  const statPlugs: Array<{ stat: ArmorStatName; value: number }> = [];

  // First pass — read the currently installed plug per socket. We
  // intentionally do NOT filter by `socket.isVisible`: the Armor 3.0
  // archetype plug (e.g. "Gunner") and the 3 stat plugs are `isVisible: false`
  // because they're intrinsic, not interactive. Tuning is visible. We only
  // require an enabled plug hash.
  for (let i = 0; i < sockets.length; i++) {
    const socket = sockets[i];
    if (!socket.plugHash || !socket.isEnabled) continue;
    if (archetypeHash === null && lookups.archetypeByPlug.has(socket.plugHash)) {
      archetypeHash = lookups.archetypeByPlug.get(socket.plugHash) ?? null;
      archetypeName =
        archetypeHash !== null
          ? lookups.archetypeNameByHash.get(archetypeHash) ?? null
          : null;
      continue;
    }
    if (tuningHash === null && lookups.tuningByPlug.has(socket.plugHash)) {
      tuningHash = lookups.tuningByPlug.get(socket.plugHash) ?? null;
      tuningName =
        tuningHash !== null
          ? lookups.tuningNameByHash.get(tuningHash) ?? null
          : null;
      tuningCommitted = true;
      continue;
    }
    const stat = lookups.statPlug.get(socket.plugHash);
    if (stat) {
      statPlugs.push(stat);
    }
  }

  // Second pass — if no tuning is currently slotted, the piece may still have
  // a destined tuned-stat direction baked in at drop time. Bungie exposes the
  // socket's available reusable plugs (component 310). For an Armor 3.0
  // tuning slot those entries are 5 variants that all share the same +stat
  // direction (and only differ by which stat they debuff), so any one
  // reveals the piece's tuning. Pulling this means a dropped-but-uncommitted
  // piece still gets bucketed into the correct tuning view of the tracker.
  if (tuningHash === null) {
    for (let i = 0; i < sockets.length; i++) {
      const candidates = reusablePlugs[String(i)] ?? [];
      let found: number | null = null;
      for (const c of candidates) {
        const t = lookups.tuningByPlug.get(c.plugItemHash);
        if (t !== undefined) {
          found = t;
          break;
        }
      }
      if (found !== null) {
        tuningHash = found;
        tuningName = lookups.tuningNameByHash.get(found) ?? null;
        tuningCommitted = false;
        break;
      }
    }
  }

  const ranked = [...statPlugs].sort((a, b) => b.value - a.value);
  const primaryStat = ranked[0]?.stat ?? null;
  const secondaryStat = ranked[1]?.stat ?? null;
  const tertiaryStat = ranked[2]?.stat ?? null;

  return {
    itemInstanceId: item.itemInstanceId,
    itemHash: item.itemHash,
    slot,
    classType,
    setHash,
    setName,
    archetypeHash,
    archetypeName,
    tuningHash,
    tuningName,
    tuningCommitted,
    primaryStat,
    secondaryStat,
    tertiaryStat,
    location,
  };
}

export function deriveAllArmorPieces(
  profile: ProfileResponse,
  lookups: ManifestLookups,
): DerivedArmorPieceJson[] {
  const entries = collectArmorItems(profile, lookups);
  const out: DerivedArmorPieceJson[] = [];
  for (const entry of entries) {
    const d = deriveArmorPiece(entry, profile, lookups);
    if (d) out.push(d);
  }
  return out;
}
