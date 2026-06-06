import { describe, expect, it } from "vitest";
import { ARMOR_STAT_NAMES } from "@/lib/db/types";
import type { ExoticLock } from "@/lib/optimizer/exotic-lock";
import type { SetBonusSelection } from "@/lib/optimizer/set-bonus";
import type { StatConstraintRow } from "@/lib/optimizer/types";
import { optimizerAutoRunReadiness } from "@/lib/optimizer/auto-run-readiness";

function constraints(active: Partial<Record<(typeof ARMOR_STAT_NAMES)[number], number>> = {}): StatConstraintRow[] {
  return ARMOR_STAT_NAMES.map((stat) => ({ stat, min: active[stat] ?? 0 }));
}

const oneSetBonus: SetBonusSelection[] = [
  { setHash: 1, requiredCount: 2, perkHash: 10 },
];

const lockedExotic: ExoticLock = {
  mode: "locked",
  itemInstanceId: "exotic-1",
  slot: "helmet",
};

describe("optimizerAutoRunReadiness", () => {
  it("keeps one armor set selection passive", () => {
    expect(
      optimizerAutoRunReadiness({
        constraints: constraints(),
        selectedSetBonuses: oneSetBonus,
        exoticLock: { mode: "none" },
      }),
    ).toEqual({
      state: "not-enough-intent",
      message: "Add another target to start auto-generating.",
    });
  });

  it("keeps one modest stat target passive", () => {
    expect(
      optimizerAutoRunReadiness({
        constraints: constraints({ Weapons: 50 }),
        selectedSetBonuses: [],
        exoticLock: { mode: "none" },
      }).state,
    ).toBe("not-enough-intent");
  });

  it("allows one high stat target to auto-run", () => {
    expect(
      optimizerAutoRunReadiness({
        constraints: constraints({ Weapons: 150 }),
        selectedSetBonuses: [],
        exoticLock: { mode: "none" },
      }),
    ).toEqual({ state: "ready", delayMs: 600 });
  });

  it("allows a stat target plus armor set to auto-run", () => {
    expect(
      optimizerAutoRunReadiness({
        constraints: constraints({ Weapons: 50 }),
        selectedSetBonuses: oneSetBonus,
        exoticLock: { mode: "none" },
      }).state,
    ).toBe("ready");
  });

  it("allows a locked exotic plus armor set to auto-run", () => {
    expect(
      optimizerAutoRunReadiness({
        constraints: constraints(),
        selectedSetBonuses: oneSetBonus,
        exoticLock: lockedExotic,
      }).state,
    ).toBe("ready");
  });

  it("auto-runs regardless of how large the search space is", () => {
    // Size no longer gates auto-run: enough intent always runs, even when the
    // underlying vault would yield a huge loadout-combination count.
    expect(
      optimizerAutoRunReadiness({
        constraints: constraints({ Weapons: 100, Health: 100 }),
        selectedSetBonuses: [],
        exoticLock: { mode: "none" },
      }),
    ).toEqual({ state: "ready", delayMs: 600 });
  });
});
