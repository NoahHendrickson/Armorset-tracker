import "server-only";
import {
  ARMOR_BUCKET_TO_SLOT,
  type ArmorSlot,
} from "@/lib/bungie/constants";
import type { ItemComponent, ProfileResponse } from "@/lib/bungie/types";
import {
  resolveArmorCatalogItem,
  type ManifestLookups,
} from "@/lib/manifest/lookups";
import {
  ARMOR_STAT_NAMES,
  type ArmorStatName,
  type DerivedArmorPieceJson,
  type ItemLocationJson,
} from "@/lib/db/types";
import {
  armorTierFromIntrinsicMagnitudes,
  buildStatTotals,
  tuningDeltasFromDisplayName,
} from "@/lib/inventory/compute-stat-totals";
import { buildPieceDisplayAndTuning } from "@/lib/inventory/armor-tuning-stats";
import {
  instanceArmorStatTotals,
  resolveExoticStatTotals,
  stripSlottedStatMods,
} from "@/lib/inventory/instance-armor-stats";
import { exoticPieceIdentityKey } from "@/lib/optimizer/exotic-lock";

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
  return resolveArmorCatalogItem(lookups, item.itemHash) != null;
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

  const catalog = resolveArmorCatalogItem(lookups, item.itemHash);
  const isExotic = catalog?.kind === "exotic";
  // Equipment-slot bucketHash works for character inv/equipment; vault items
  // need the manifest fallback since their bucketHash is the vault bucket.
  const slot: ArmorSlot | undefined =
    ARMOR_BUCKET_TO_SLOT[item.bucketHash] ?? catalog?.slot;
  if (!slot) return null;

  const setHash = catalog?.kind === "legendary" ? catalog.setHash : null;
  const setName = catalog?.kind === "legendary" ? catalog.setName : null;
  const displayName =
    catalog?.kind === "exotic"
      ? catalog.name
      : catalog?.kind === "legendary"
        ? catalog.setName
        : null;
  const classType = catalog?.classType ?? null;
  const iconPath =
    catalog?.iconPath && catalog.iconPath.length > 0 ? catalog.iconPath : undefined;

  const sockets =
    profile.itemComponents?.sockets?.data?.[item.itemInstanceId]?.sockets ?? [];
  const reusablePlugs =
    profile.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]?.plugs ??
    {};

  let archetypeHash: number | null = null;
  let archetypeName: string | null = null;
  let tuningHash: number | null = null;
  let tuningName: string | null = null;
  let tuningPlugHash: number | null = null;
  let tuningCommitted = false;
  // Armor 3.0 pieces have 3 hidden "armor_stats" plugs whose magnitudes (+30 /
  // +25 / +20 for Tier 5) determine the primary / secondary / tertiary stat.
  const statPlugs: Array<{ stat: ArmorStatName; value: number }> = [];

  const readSockets = (requireEnabled: boolean) => {
    for (let i = 0; i < sockets.length; i++) {
      const socket = sockets[i];
      if (!socket.plugHash) continue;
      if (requireEnabled && !socket.isEnabled) continue;
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
        tuningPlugHash = socket.plugHash;
        tuningCommitted = true;
        continue;
      }
      const stat = lookups.statPlug.get(socket.plugHash);
      if (stat) statPlugs.push(stat);
    }
  };

  // Armor 3.0 intrinsics are often `isVisible: false`; exotics may report
  // stat plugs as disabled — legendaries still require an enabled plug.
  readSockets(!isExotic);

  if (isExotic && statPlugs.length === 0) {
    let budget =
      lookups.exoticStatBudgetByItemHash.get(item.itemHash) ?? null;
    if (
      (!budget || Object.keys(budget).length === 0) &&
      displayName != null
    ) {
      budget =
        lookups.exoticStatBudgetByIdentity.get(
          exoticPieceIdentityKey({
            itemInstanceId: item.itemInstanceId,
            itemHash: item.itemHash,
            slot,
            classType,
            setHash: null,
            setName: null,
            displayName,
            isExotic: true,
            archetypeHash: null,
            archetypeName: null,
            tuningHash: null,
            tuningName: null,
            primaryStat: null,
            secondaryStat: null,
            tertiaryStat: null,
            location,
          }),
        ) ?? null;
    }
    if (budget) {
      for (const stat of ARMOR_STAT_NAMES) {
        const value = budget[stat];
        if (value) statPlugs.push({ stat, value });
      }
    }
  }

  // Second pass — if no tuning is currently slotted, the piece may still have
  // a destined tuned-stat direction baked in at drop time. Bungie exposes the
  // socket's available reusable plugs (component 310). For an Armor 3.0
  // tuning slot those entries are 5 variants that all share the same +stat
  // direction (and only differ by which stat they debuff), so any one
  // reveals the piece's tuning. Pulling this means a dropped-but-uncommitted
  // piece still gets bucketed into the correct tuning view of the tracker.
  const tuningVariantPlugHashes: number[] = [];
  if (tuningHash === null) {
    for (let i = 0; i < sockets.length; i++) {
      const candidates = reusablePlugs[String(i)] ?? [];
      let found: number | null = null;
      for (const c of candidates) {
        const t = lookups.tuningByPlug.get(c.plugItemHash);
        if (t !== undefined) {
          if (found === null) found = t;
          tuningVariantPlugHashes.push(c.plugItemHash);
        }
      }
      if (found !== null) {
        tuningHash = found;
        tuningName = lookups.tuningNameByHash.get(found) ?? null;
        tuningPlugHash = tuningVariantPlugHashes[0] ?? null;
        tuningCommitted = false;
        break;
      }
    }
  }

  const resolveTuningDeltas = (plugHash: number | null) => {
    if (plugHash === null) return [];
    const fromManifest = lookups.tuningPlugStats.get(plugHash);
    if (fromManifest && fromManifest.length > 0) return fromManifest;
    const plugTuningHash = lookups.tuningByPlug.get(plugHash);
    const displayName =
      plugTuningHash != null
        ? lookups.tuningNameByHash.get(plugTuningHash)
        : tuningName;
    return tuningDeltasFromDisplayName(displayName ?? "") ?? [];
  };

  const committedTuningDeltas = tuningCommitted
    ? resolveTuningDeltas(tuningPlugHash)
    : [];

  const tier = isExotic
    ? null
    : armorTierFromIntrinsicMagnitudes(statPlugs.map((p) => p.value));

  let { statTotals, tuningDeltas } = buildPieceDisplayAndTuning(
    statPlugs,
    committedTuningDeltas,
    tier,
  );

  statTotals = resolveExoticStatTotals(
    isExotic,
    item.itemInstanceId,
    profile,
    statTotals,
    lookups.destinyStatHashToArmorStat,
  );

  if (isExotic) {
    const fromInstance = instanceArmorStatTotals(
      item.itemInstanceId,
      profile,
      lookups.destinyStatHashToArmorStat,
    );
    const stripBase =
      fromInstance && Object.keys(fromInstance).length > 0
        ? fromInstance
        : statTotals;
    statTotals = stripSlottedStatMods(
      stripBase,
      sockets,
      lookups.statModPlugStats,
    );
  }

  const uniqueVariantPlugHashes = [
    ...new Set(tuningVariantPlugHashes),
  ];
  const tuningVariants =
    !tuningCommitted && uniqueVariantPlugHashes.length > 1
      ? uniqueVariantPlugHashes.map((plugHash) =>
          buildStatTotals(statPlugs, resolveTuningDeltas(plugHash)),
        )
      : undefined;

  const rankedSource =
    statPlugs.length > 0
      ? statPlugs
      : ARMOR_STAT_NAMES.map((stat) => ({
          stat,
          value: statTotals[stat] ?? 0,
        })).filter((row) => row.value > 0);
  const ranked = [...rankedSource].sort((a, b) => b.value - a.value);
  const primaryStat = ranked[0]?.stat ?? null;
  const secondaryStat = ranked[1]?.stat ?? null;
  const tertiaryStat = ranked[2]?.stat ?? null;

  return {
    itemInstanceId: item.itemInstanceId,
    itemHash: item.itemHash,
    ...(iconPath ? { iconPath } : {}),
    slot,
    classType,
    setHash,
    setName,
    displayName,
    isExotic,
    archetypeHash,
    archetypeName,
    tuningHash,
    tuningName,
    tuningCommitted,
    primaryStat,
    secondaryStat,
    tertiaryStat,
    tier,
    statTotals,
    ...(tuningDeltas && tuningDeltas.length > 0 ? { tuningDeltas } : {}),
    ...(tuningVariants ? { tuningVariants } : {}),
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
