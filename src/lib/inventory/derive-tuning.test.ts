import { describe, expect, it } from "vitest";
import { buildStatTotals } from "@/lib/inventory/compute-stat-totals";
import { resolveLoadoutTotals } from "@/lib/optimizer/resolve-loadout-totals";
import { mockPiece } from "@/lib/optimizer/__fixtures__/pieces";
import { SLOT_ORDER } from "@/lib/bungie/constants";

/**
 * Contract tests for inventory derive output shapes used by the optimizer.
 * Full deriveArmorPiece needs Bungie profile fixtures; these assert the
 * tuningVariants contract that derive.ts emits for uncommitted sockets.
 */
describe("derive tuningVariants contract", () => {
  it("builds distinct debuff branches with a fixed +stat", () => {
    const intrinsics = [
      { stat: "Weapons" as const, value: 30 },
      { stat: "Health" as const, value: 25 },
      { stat: "Class" as const, value: 20 },
    ];
    const variants = [
      buildStatTotals(intrinsics, [
        { stat: "Weapons", value: 5 },
        { stat: "Grenade", value: -5 },
      ]),
      buildStatTotals(intrinsics, [
        { stat: "Weapons", value: 5 },
        { stat: "Melee", value: -5 },
      ]),
    ];
    expect(variants[0]!.Weapons).toBe(35);
    expect(variants[1]!.Weapons).toBe(35);
    expect(variants[0]!.Grenade).toBe(-5);
    expect(variants[1]!.Melee).toBe(-5);
  });

  it("resolveLoadoutTotals picks one branch per uncommitted piece", () => {
    const pool = SLOT_ORDER.map((slot, index) => {
      if (index === 0) {
        return {
          ...mockPiece(slot, `id-${slot}`, {
            Weapons: 30,
            Health: 25,
            Class: 20,
          }),
          tuningCommitted: false,
          tuningVariants: [
            { Weapons: 35, Health: 25, Class: 20, Grenade: -5 },
            { Weapons: 35, Health: 25, Class: 20, Melee: -5 },
          ],
        };
      }
      return mockPiece(slot, `id-${slot}`, {
        Weapons: 35,
        Health: 25,
        Class: 20,
      });
    });
    const resolved = resolveLoadoutTotals(
      pool,
      [{ stat: "Weapons", min: 170 }],
      {},
      { majorCount: 2, slotFill: true },
    );
    expect(resolved).not.toBeNull();
    const debuffs = [
      resolved!.totals.Grenade,
      resolved!.totals.Melee,
    ].filter((v) => v < 0);
    expect(debuffs.length).toBeLessThanOrEqual(1);
  });
});
