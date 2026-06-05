import { describe, expect, it } from "vitest";
import { MAJOR_ARMOR_STAT_MOD, MINOR_ARMOR_STAT_MOD } from "@/lib/optimizer/mod-offset";
import { OPTIMIZER_STAT_MAX } from "@/lib/optimizer/stat-range";
import { allocatePlanMods, zeroArmorTotals } from "@/lib/plan/allocate-plan-mods";

describe("allocatePlanMods", () => {
  it("fills primary toward 200 with minors when a major would overshoot", () => {
    const armor = { ...zeroArmorTotals(), Weapons: 195, Super: 50 };
    const { totals, modAllocation } = allocatePlanMods(
      armor,
      { primaryStat: "Weapons", secondaryStat: "Super" },
      { majorCount: 1, slotFill: true, artifice: false },
    );
    expect(totals.Weapons).toBe(200);
    expect(modAllocation.Weapons).toBe(MINOR_ARMOR_STAT_MOD);
    expect(totals.Super).toBe(
      50 + MAJOR_ARMOR_STAT_MOD + MINOR_ARMOR_STAT_MOD * 3,
    );
  });

  it("does not assign mods to primary when already at 200", () => {
    const armor = { ...zeroArmorTotals(), Weapons: 200, Super: 40 };
    const { totals, modAllocation } = allocatePlanMods(
      armor,
      { primaryStat: "Weapons", secondaryStat: "Super" },
      { majorCount: 3, slotFill: true, artifice: false },
    );
    expect(modAllocation.Weapons).toBeUndefined();
    expect(totals.Weapons).toBe(200);
    expect(totals.Super).toBe(40 + MAJOR_ARMOR_STAT_MOD * 3 + MINOR_ARMOR_STAT_MOD * 2);
  });

  it("keeps primary at or below one major overshoot of 200", () => {
    const armor = { ...zeroArmorTotals(), Weapons: 192 };
    const { totals } = allocatePlanMods(
      armor,
      { primaryStat: "Weapons", secondaryStat: "Super" },
      { majorCount: 5, slotFill: true, artifice: false },
    );
    expect(totals.Weapons).toBeLessThanOrEqual(OPTIMIZER_STAT_MAX + MAJOR_ARMOR_STAT_MOD);
    expect(totals.Weapons).toBeGreaterThanOrEqual(OPTIMIZER_STAT_MAX);
  });
});
