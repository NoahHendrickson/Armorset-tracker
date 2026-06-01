import { SLOT_ORDER } from "@/lib/bungie/constants";
import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";

export function mockPiece(
  slot: DerivedArmorPieceJson["slot"],
  id: string,
  statTotals: Partial<Record<ArmorStatName, number>>,
  extra: Partial<DerivedArmorPieceJson> = {},
): DerivedArmorPieceJson {
  return {
    itemInstanceId: id,
    itemHash: 1,
    slot,
    classType: 0,
    setHash: 1,
    setName: "Test",
    displayName: "Test",
    archetypeHash: 1,
    archetypeName: "Gunner",
    tuningHash: 1,
    tuningName: "+Weapons / -Grenade",
    primaryStat: "Weapons",
    secondaryStat: "Health",
    tertiaryStat: "Class",
    statTotals: statTotals as DerivedArmorPieceJson["statTotals"],
    location: { kind: "vault" },
    ...extra,
  };
}

export function mockFivePiecePool(
  perSlot: Partial<Record<ArmorStatName, number>>,
  slotOverrides: Partial<
    Record<DerivedArmorPieceJson["slot"], Partial<DerivedArmorPieceJson>>
  > = {},
): DerivedArmorPieceJson[] {
  return SLOT_ORDER.map((slot) => {
    const override = slotOverrides[slot] ?? {};
    return mockPiece(slot, `id-${slot}`, perSlot, override);
  });
}
