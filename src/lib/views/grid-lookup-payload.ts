import type { ArmorSlot } from "@/lib/bungie/constants";
import { SLOT_ORDER } from "@/lib/bungie/constants";
import type { ArmorStatName } from "@/lib/db/types";

/**
 * Plain-JSON subset of `ManifestLookups` safe to ship to the client. Used by
 * the dashboard Tracker grid to build ephemeral tracker payloads on demand
 * (without going through the `server-only` builder).
 */
export interface GridLookupPayload {
  setNameByHash: Record<string, string>;
  archetypeNameByHash: Record<string, string>;
  tuningNameByHash: Record<string, string>;
  /** `${setHash}:${classType}:${slot}` → relative icon path. */
  armorSlotIconByKey: Record<string, string>;
  /** Per-slot fallback icon when no exact set+class+slot row exists. */
  slotFallbackIconByName: Partial<Record<ArmorSlot, string>>;
  archetypeStatPair: Record<
    string,
    { primary: ArmorStatName; secondary: ArmorStatName }
  >;
  statIconByName: Partial<Record<ArmorStatName, string>>;
}

export function gridLookupArmorSlotIconKey(
  setHash: number,
  classType: number,
  slot: ArmorSlot,
): string {
  return `${setHash}:${classType}:${slot}`;
}

/**
 * Per-slot icon paths for a given set + class, picking the canonical exact
 * match first, then the slot fallback. Mirrors `armorSlotIconPathsForView` in
 * `src/lib/manifest/lookups.ts`, but reads from the client-safe payload.
 */
export function armorSlotIconPathsFromGridLookup(
  lookup: GridLookupPayload,
  setHash: number,
  classType: number,
): Partial<Record<ArmorSlot, string>> {
  const out: Partial<Record<ArmorSlot, string>> = {};
  for (const slot of SLOT_ORDER) {
    let path: string | undefined;
    if (classType >= 0) {
      path = lookup.armorSlotIconByKey[
        gridLookupArmorSlotIconKey(setHash, classType, slot)
      ];
    } else {
      for (const cls of [0, 1, 2, 3] as const) {
        path = lookup.armorSlotIconByKey[
          gridLookupArmorSlotIconKey(setHash, cls, slot)
        ];
        if (path) break;
      }
    }
    if (!path) path = lookup.slotFallbackIconByName[slot];
    if (path) out[slot] = path;
  }
  return out;
}
