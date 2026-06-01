import "server-only";

import type { ManifestLookups } from "@/lib/manifest/lookups";
import {
  CANONICAL_OPTIMIZER_SUBCLASS_KEYS,
  classTypeFromSubclassKey,
  subclassLabel,
  subclassesForClassType,
} from "@/lib/optimizer/subclass-key";
import type { ExoticStatBudgetLookup } from "@/lib/inventory/exotic-stat-fallback";
import type {
  FragmentPlugPayload,
  OptimizerLookupPayload,
  SetPerkPayload,
  SubclassOption,
} from "@/lib/views/optimizer-lookup-payload";

export function buildOptimizerLookupPayload(
  lookups: ManifestLookups,
): OptimizerLookupPayload {
  const fragmentPlugs: FragmentPlugPayload[] = [];
  const fragmentPlugsByHash: Record<string, FragmentPlugPayload> = {};
  const fragmentsBySubclass: Record<string, FragmentPlugPayload[]> = {};
  const subclassKeys = new Set<string>();

  for (const [plugHash, meta] of lookups.fragmentPlugByHash) {
    const entry: FragmentPlugPayload = {
      plugHash,
      name: meta.name,
      iconPath: meta.iconPath,
      subclassKey: meta.subclassKey,
      deltas: meta.deltas,
    };
    fragmentPlugs.push(entry);
    fragmentPlugsByHash[String(plugHash)] = entry;
    subclassKeys.add(meta.subclassKey);
    const bucket = fragmentsBySubclass[meta.subclassKey] ?? [];
    bucket.push(entry);
    fragmentsBySubclass[meta.subclassKey] = bucket;
  }

  for (const key of CANONICAL_OPTIMIZER_SUBCLASS_KEYS) {
    subclassKeys.add(key);
  }

  fragmentPlugs.sort((a, b) => a.name.localeCompare(b.name));
  for (const key of Object.keys(fragmentsBySubclass)) {
    fragmentsBySubclass[key]!.sort((a, b) => a.name.localeCompare(b.name));
  }

  const subclasses: SubclassOption[] = subclassesForClassType(
    subclassKeys,
    -1,
  ).map((key) => ({
    key,
    label: subclassLabel(key),
    element: key.split(".")[0] ?? key,
    classType: classTypeFromSubclassKey(key),
  }));

  const setPerks: SetPerkPayload[] = [];
  const setPerksBySetHash: Record<string, SetPerkPayload[]> = {};
  for (const perk of lookups.armorSetPerks) {
    const entry: SetPerkPayload = {
      setHash: perk.setHash,
      setName: perk.setName,
      requiredSetCount: perk.requiredSetCount,
      perkHash: perk.perkHash,
      name: perk.name,
      description: perk.description,
      iconPath: perk.iconPath,
    };
    setPerks.push(entry);
    const bucket = setPerksBySetHash[String(perk.setHash)] ?? [];
    bucket.push(entry);
    setPerksBySetHash[String(perk.setHash)] = bucket;
  }
  setPerks.sort((a, b) => {
    const setCmp = a.setName.localeCompare(b.setName);
    if (setCmp !== 0) return setCmp;
    return a.requiredSetCount - b.requiredSetCount;
  });

  const exoticStatBudget = buildExoticStatBudgetPayload(lookups);

  return {
    fragmentPlugsByHash,
    fragmentPlugs,
    subclasses,
    fragmentsBySubclass,
    setPerks,
    setPerksBySetHash,
    exoticStatBudget,
  };
}

function buildExoticStatBudgetPayload(
  lookups: ManifestLookups,
): ExoticStatBudgetLookup {
  const byItemHash: ExoticStatBudgetLookup["byItemHash"] = {};
  for (const [itemHash, totals] of lookups.exoticStatBudgetByItemHash) {
    byItemHash[String(itemHash)] = totals;
  }
  const byIdentity: ExoticStatBudgetLookup["byIdentity"] = {};
  for (const [identityKey, totals] of lookups.exoticStatBudgetByIdentity) {
    byIdentity[identityKey] = totals;
  }
  return { byItemHash, byIdentity };
}
