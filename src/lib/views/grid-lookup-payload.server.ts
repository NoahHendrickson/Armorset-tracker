import "server-only";

import type { ManifestLookups } from "@/lib/manifest/lookups";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";

/** Serialize the Map-based manifest lookups into a JSON-safe payload. */
export function buildGridLookupPayload(
  lookups: ManifestLookups,
): GridLookupPayload {
  const setNameByHash: Record<string, string> = {};
  for (const [hash, name] of lookups.setNameByHash) {
    setNameByHash[String(hash)] = name;
  }

  const archetypeNameByHash: Record<string, string> = {};
  for (const [hash, name] of lookups.archetypeNameByHash) {
    archetypeNameByHash[String(hash)] = name;
  }

  const tuningNameByHash: Record<string, string> = {};
  for (const [hash, name] of lookups.tuningNameByHash) {
    tuningNameByHash[String(hash)] = name;
  }

  const armorSlotIconByKey: Record<string, string> = {};
  for (const [key, path] of lookups.armorSlotIconPathBySetClassSlot) {
    armorSlotIconByKey[key] = path;
  }

  const slotFallbackIconByName: GridLookupPayload["slotFallbackIconByName"] = {};
  for (const [slot, path] of lookups.slotFallbackIconPathBySlot) {
    slotFallbackIconByName[slot] = path;
  }

  const archetypeStatPair: GridLookupPayload["archetypeStatPair"] = {};
  for (const [hash, pair] of lookups.archetypeStatPair) {
    archetypeStatPair[String(hash)] = pair;
  }

  const statIconByName: GridLookupPayload["statIconByName"] = {};
  for (const [stat, path] of lookups.statIconByName) {
    statIconByName[stat] = path;
  }

  return {
    setNameByHash,
    archetypeNameByHash,
    tuningNameByHash,
    armorSlotIconByKey,
    slotFallbackIconByName,
    archetypeStatPair,
    statIconByName,
  };
}
