import { describe, expect, it } from "vitest";
import { ARMOR_STAT_NAMES } from "@/lib/db/types";
import {
  partialCanReachMins,
  satisfiesConstraints,
} from "@/lib/optimizer/constraints";

describe("partialCanReachMins", () => {
  it("includes assumed mod budget so high mins are not pruned too early", () => {
    const perSlotMax = Object.fromEntries(
      ARMOR_STAT_NAMES.map((stat) => [stat, stat === "Weapons" ? 30 : 25]),
    ) as Record<(typeof ARMOR_STAT_NAMES)[number], number>;
    const partial = Object.fromEntries(
      ARMOR_STAT_NAMES.map((stat) => [stat, stat === "Weapons" ? 30 : 0]),
    ) as Record<(typeof ARMOR_STAT_NAMES)[number], number>;

    const withoutMods = partialCanReachMins(
      partial,
      4,
      perSlotMax,
      [{ stat: "Weapons", min: 158 }],
    );
    const withMods = partialCanReachMins(
      partial,
      4,
      perSlotMax,
      [{ stat: "Weapons", min: 158 }],
      { majorCount: 4 },
    );

    expect(withoutMods).toBe(false);
    expect(withMods).toBe(true);
  });

  it("rejects when combined mod deficits exceed the shared pool", () => {
    const perSlotMax = {
      Weapons: 30,
      Grenade: 16,
      Health: 25,
      Class: 20,
      Melee: 20,
      Super: 20,
    } as Record<(typeof ARMOR_STAT_NAMES)[number], number>;
    const partial = Object.fromEntries(
      ARMOR_STAT_NAMES.map((stat) => [stat, 0]),
    ) as Record<(typeof ARMOR_STAT_NAMES)[number], number>;

    const canReachBoth = partialCanReachMins(
      partial,
      5,
      perSlotMax,
      [
        { stat: "Weapons", min: 200 },
        { stat: "Grenade", min: 100 },
      ],
      { majorCount: 5, slotFill: true, artifice: true },
    );
    expect(canReachBoth).toBe(false);
  });
});

describe("satisfiesConstraints", () => {
  it("allows a single major mod to overshoot the 200 track cap", () => {
    expect(
      satisfiesConstraints(
        {
          Weapons: 205,
          Health: 0,
          Class: 0,
          Grenade: 0,
          Melee: 0,
          Super: 0,
        },
        [{ stat: "Weapons", min: 200 }],
      ),
    ).toBe(true);
  });

  it("allows high armor totals on stats with low minimums", () => {
    expect(
      satisfiesConstraints(
        {
          Weapons: 205,
          Health: 215,
          Class: 90,
          Grenade: 105,
          Melee: 45,
          Super: 75,
        },
        [
          { stat: "Weapons", min: 200 },
          { stat: "Health", min: 10 },
          { stat: "Grenade", min: 100 },
          { stat: "Super", min: 70 },
        ],
      ),
    ).toBe(true);
  });

  it("rejects per-stat totals far above the track maximum", () => {
    expect(
      satisfiesConstraints(
        {
          Weapons: 200,
          Health: 125,
          Class: 275,
          Grenade: 100,
          Melee: 50,
          Super: 70,
        },
        [
          { stat: "Weapons", min: 200 },
          { stat: "Class", min: 50 },
        ],
      ),
    ).toBe(false);
  });

  it("accepts loadouts where tuning debuffs sum below zero on unused stats", () => {
    expect(
      satisfiesConstraints(
        {
          Weapons: 196,
          Health: -7,
          Class: 54,
          Grenade: 121,
          Melee: -1,
          Super: 70,
        },
        [
          { stat: "Weapons", min: 196 },
          { stat: "Class", min: 50 },
          { stat: "Grenade", min: 100 },
          { stat: "Super", min: 70 },
        ],
      ),
    ).toBe(true);
  });
});
