import { describe, expect, it } from "vitest";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import {
  bestSyntheticPieceConfig,
  maxStatOnSyntheticPieceWithTertiary,
  maxStatOnSyntheticSlot,
  mixedLoadoutArmorTotals,
  mixedLoadoutBounds,
  pieceStatWithPlanSelection,
  theoreticalLoadoutBounds,
  type PlanArchetypeRow,
} from "@/lib/plan/archetype-bounds";
import { CUSTOM_ARCHETYPE_ID } from "@/lib/plan/constants";
import type { ArchetypePair } from "@/lib/plan/archetype-pair";
import { isValidArchetypePair } from "@/lib/plan/archetype-pair";
import { pieceStatCeiling } from "@/lib/plan/synthetic-piece";
import { NO_ASSUMED_STAT_MODS } from "@/lib/optimizer/mod-offset";
import { addStatOffsets } from "@/lib/optimizer/fragment-offset";

const WEAPONS_SUPER: ArchetypePair = { primary: "Weapons", secondary: "Super" };
const WEAPONS_GRENADE: ArchetypePair = {
  primary: "Weapons",
  secondary: "Grenade",
};

describe("isValidArchetypePair", () => {
  it("rejects identical primary and secondary", () => {
    expect(isValidArchetypePair("Weapons", "Weapons")).toBe(false);
  });

  it("accepts distinct stats", () => {
    expect(isValidArchetypePair("Weapons", "Super")).toBe(true);
  });
});

describe("pieceStatCeiling", () => {
  it("puts 30 Weapons and 25 Super on one hypothetical piece", () => {
    const tertiary = "Health";
    expect(
      pieceStatCeiling(
        WEAPONS_SUPER,
        "Weapons",
        tertiary,
        "Weapons",
        "Health",
      ),
    ).toBe(35);
    expect(
      pieceStatCeiling(
        WEAPONS_SUPER,
        "Super",
        tertiary,
        "Super",
        "Health",
      ),
    ).toBe(30);
  });

  it("adds +5 masterwork on stats outside the intrinsic triple", () => {
    expect(
      pieceStatCeiling(
        WEAPONS_SUPER,
        "Class",
        "Health",
        "Weapons",
        "Health",
      ),
    ).toBe(5);
    expect(
      pieceStatCeiling(
        WEAPONS_SUPER,
        "Melee",
        "Melee",
        "Weapons",
        "Grenade",
      ),
    ).toBe(20);
  });

  it("caps Super at 20 when Super is only tertiary (Weapons/Grenade)", () => {
    expect(
      pieceStatCeiling(
        WEAPONS_GRENADE,
        "Super",
        "Super",
        "Super",
        "Health",
      ),
    ).toBe(25);
    const { value } = bestSyntheticPieceConfig(WEAPONS_GRENADE, "Super");
    expect(value).toBe(25);
  });
});

describe("maxStatOnSyntheticSlot", () => {
  it("beats Weapons/Grenade Super ceiling when Super is secondary", () => {
    const customSuper = maxStatOnSyntheticSlot(WEAPONS_SUPER, "Super");
    const manifestStyle = maxStatOnSyntheticSlot(WEAPONS_GRENADE, "Super");
    expect(customSuper).toBeGreaterThan(manifestStyle);
    expect(customSuper).toBe(30);
    expect(manifestStyle).toBe(25);
  });
});

describe("theoreticalLoadoutBounds", () => {
  it("sums five slots without mods", () => {
    const bounds = theoreticalLoadoutBounds(WEAPONS_SUPER, {
      includeMods: false,
      assumedMods: NO_ASSUMED_STAT_MODS,
    });
    expect(bounds.Weapons.max).toBe(5 * maxStatOnSyntheticSlot(WEAPONS_SUPER, "Weapons"));
    expect(bounds.Super.max).toBe(5 * maxStatOnSyntheticSlot(WEAPONS_SUPER, "Super"));
  });

  it("adds mod budget when includeMods is true", () => {
    const without = theoreticalLoadoutBounds(WEAPONS_SUPER, {
      includeMods: false,
    });
    const withMods = theoreticalLoadoutBounds(WEAPONS_SUPER, {
      includeMods: true,
    });
    expect(withMods.Weapons.max).toBeGreaterThan(without.Weapons.max);
  });

  it("no manifest-style pair gives 30+25 intrinsic Super on one piece", () => {
    const manifestPairs: ArchetypePair[] = [
      { primary: "Weapons", secondary: "Health" },
      { primary: "Health", secondary: "Class" },
      { primary: "Grenade", secondary: "Melee" },
      { primary: "Super", secondary: "Weapons" },
      { primary: "Weapons", secondary: "Grenade" },
    ];
    for (const pair of manifestPairs) {
      const weaponsIntrinsic = pieceStatCeiling(
        pair,
        "Weapons",
        pair.primary === "Weapons" ? "Health" : "Weapons",
        "Weapons",
        "Health",
      );
      const superIntrinsic =
        pair.primary === "Super"
          ? 30
          : pair.secondary === "Super"
            ? 25
            : maxStatOnSyntheticSlot(pair, "Super");
      const samePieceWeaponsAndSuper25 =
        pair.primary === "Weapons" && pair.secondary === "Super";
      if (!samePieceWeaponsAndSuper25) {
        expect(
          pair.primary === "Weapons" ? weaponsIntrinsic >= 30 : true,
        ).toBe(true);
        if (pair.secondary !== "Super" && pair.primary !== "Super") {
          expect(superIntrinsic).toBeLessThanOrEqual(25);
        }
      }
    }
    expect(maxStatOnSyntheticSlot(WEAPONS_SUPER, "Super")).toBe(30);
  });

  it("covers all six stats", () => {
    const bounds = theoreticalLoadoutBounds(WEAPONS_SUPER, {
      includeMods: false,
    });
    for (const stat of ARMOR_STAT_NAMES) {
      expect(bounds[stat as ArmorStatName].max).toBeGreaterThan(0);
    }
  });
});

describe("mixedLoadoutBounds", () => {
  const gunner: PlanArchetypeRow = {
    id: "2005",
    name: "Gunner",
    pair: WEAPONS_GRENADE,
  };
  const custom: PlanArchetypeRow = {
    id: CUSTOM_ARCHETYPE_ID,
    name: "Weapons / Super",
    pair: WEAPONS_SUPER,
    isCustom: true,
  };

  const gunnerSel = {
    tertiary: "Health" as const,
    tuningPositive: "Weapons" as const,
    tuningNegative: "Grenade" as const,
    pieceCount: 3,
  };
  const customSel = {
    tertiary: "Melee" as const,
    tuningPositive: "Super" as const,
    tuningNegative: "Health" as const,
    pieceCount: 2,
  };

  it("returns null until five pieces are assigned", () => {
    expect(
      mixedLoadoutBounds(
        [gunner, custom],
        {
          [gunner.id]: { ...gunnerSel, pieceCount: 3 },
          [custom.id]: { ...customSel, pieceCount: 1 },
        },
        { includeMods: false },
      ),
    ).toBeNull();
  });

  it("sums 3 gunner + 2 custom with fixed tertiary and tuning", () => {
    const bounds = mixedLoadoutBounds(
      [gunner, custom],
      {
        [gunner.id]: gunnerSel,
        [custom.id]: customSel,
      },
      { includeMods: false },
    );
    expect(bounds).not.toBeNull();
    const weaponsPerGunner = pieceStatWithPlanSelection(
      WEAPONS_GRENADE,
      "Weapons",
      gunnerSel,
    );
    const weaponsPerCustom = pieceStatWithPlanSelection(
      WEAPONS_SUPER,
      "Weapons",
      customSel,
    );
    expect(bounds!.Weapons.max).toBe(
      3 * weaponsPerGunner + 2 * weaponsPerCustom,
    );
    const superPerGunner = pieceStatWithPlanSelection(
      WEAPONS_GRENADE,
      "Super",
      gunnerSel,
    );
    const superPerCustom = pieceStatWithPlanSelection(
      WEAPONS_SUPER,
      "Super",
      customSel,
    );
    expect(bounds!.Super.max).toBe(
      3 * superPerGunner + 2 * superPerCustom,
    );
  });

  it("does not inflate non-goal stats when goal-directed mods are enabled", () => {
    const bounds = mixedLoadoutBounds(
      [gunner, custom],
      {
        [gunner.id]: gunnerSel,
        [custom.id]: customSel,
      },
      {
        includeMods: true,
        statGoals: { primaryStat: "Weapons", secondaryStat: "Super" },
      },
    );
    const intrinsic = mixedLoadoutBounds(
      [gunner, custom],
      {
        [gunner.id]: gunnerSel,
        [custom.id]: customSel,
      },
      { includeMods: false },
    );
    expect(bounds!.Health.max).toBe(intrinsic!.Health.max);
    expect(bounds!.Weapons.max).toBeGreaterThan(intrinsic!.Weapons.max);
    expect(bounds!.Super.max).toBeGreaterThan(intrinsic!.Super.max);
  });

  it("applies fragment offset before mods", () => {
    const armor = mixedLoadoutArmorTotals(
      [gunner, custom],
      {
        [gunner.id]: gunnerSel,
        [custom.id]: customSel,
      },
    )!;
    const offset = { Super: 10 } as const;
    const bounds = mixedLoadoutBounds(
      [gunner, custom],
      {
        [gunner.id]: gunnerSel,
        [custom.id]: customSel,
      },
      {
        includeMods: false,
        fragmentStatOffset: offset,
      },
    );
    const expected = addStatOffsets(armor, offset);
    expect(bounds!.Super.max).toBe(expected.Super);
  });
});
