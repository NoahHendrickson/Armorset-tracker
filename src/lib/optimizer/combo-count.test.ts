import { describe, expect, it } from "vitest";
import { ARMOR_STAT_NAMES } from "@/lib/db/types";
import { estimateFilteredComboCount, maxFeasibleStatTarget } from "@/lib/optimizer/combo-count";
import { mockPiece } from "@/lib/optimizer/__fixtures__/pieces";
import { SLOT_ORDER } from "@/lib/bungie/constants";

describe("estimateFilteredComboCount", () => {
  it("matches raw pool count when no filters are active", () => {
    const pool = SLOT_ORDER.map((slot) =>
      mockPiece(slot, `id-${slot}`, { Weapons: 40, Health: 25 }),
    );
    const { count, capped } = estimateFilteredComboCount(pool);
    expect(count).toBe(1);
    expect(capped).toBe(false);
  });

  it("shrinks when a set bonus requires specific sets", () => {
    const pool = SLOT_ORDER.flatMap((slot) => [
      mockPiece(slot, `${slot}-10a`, { Weapons: 40 }, { setHash: 10 }),
      mockPiece(slot, `${slot}-10b`, { Weapons: 41 }, { setHash: 10 }),
      mockPiece(slot, `${slot}-20`, { Weapons: 42 }, { setHash: 20 }),
    ]);
    const raw = estimateFilteredComboCount(pool, { mode: "none" }).count;
    const filtered = estimateFilteredComboCount(pool, { mode: "none" }, {
      setBonusSelections: [{ setHash: 10, requiredCount: 2, perkHash: 1 }],
    }).count;
    expect(filtered).toBeLessThan(raw);
    expect(filtered).toBeGreaterThan(0);
  });

  it("shrinks when stat minimums prune infeasible loadouts", () => {
    const pool = SLOT_ORDER.map((slot, index) =>
      mockPiece(slot, `id-${slot}`, {
        Weapons: index === 0 ? 80 : 10,
        Health: 25,
      }),
    );
    const filtered = estimateFilteredComboCount(pool, { mode: "none" }, {
      constraints: ARMOR_STAT_NAMES.map((stat) => ({
        stat,
        min: stat === "Weapons" ? 200 : 0,
      })),
      assumedMods: { majorCount: 0, slotFill: false },
    }).count;
    expect(filtered).toBe(0);
  });

  it("respects cap and reports capped=true", () => {
    const pool = SLOT_ORDER.flatMap((slot) =>
      Array.from({ length: 3 }, (_, index) =>
        mockPiece(slot, `${slot}-${index}`, { Weapons: 40 + index }),
      ),
    );
    const result = estimateFilteredComboCount(pool, { mode: "none" }, {
      setBonusSelections: [{ setHash: 1, requiredCount: 1, perkHash: 1 }],
      cap: 5,
    });
    expect(result.count).toBe(5);
    expect(result.capped).toBe(true);
  });
});

describe("maxFeasibleStatTarget", () => {
  it("returns the highest feasible minimum for a stat under other targets", () => {
    const pool = SLOT_ORDER.flatMap((slot) => [
      mockPiece(slot, `${slot}-w`, { Weapons: 40, Grenade: 5 }),
      mockPiece(slot, `${slot}-g`, { Weapons: 10, Grenade: 35 }),
    ]);
    const constraints = ARMOR_STAT_NAMES.map((stat) => ({
      stat,
      min: 0,
    }));
    constraints.find((row) => row.stat === "Weapons")!.min = 200;

    const independentGrenadeMax = 35 * 5 + 50;
    expect(independentGrenadeMax).toBeGreaterThan(150);

    const maxGrenade = maxFeasibleStatTarget(
      pool,
      { mode: "none" },
      constraints,
      "Grenade",
      { assumedMods: { majorCount: 5, slotFill: true, artifice: true } },
    );
    expect(maxGrenade).toBeLessThan(independentGrenadeMax);
    expect(maxGrenade).toBeLessThan(200);
    expect(
      estimateFilteredComboCount(
        pool,
        { mode: "none" },
        {
          constraints: constraints.map((row) =>
            row.stat === "Grenade" ? { ...row, min: maxGrenade } : row,
          ),
          assumedMods: { majorCount: 5, slotFill: true, artifice: true },
          cap: 1,
        },
      ).count,
    ).toBeGreaterThan(0);
    expect(
      estimateFilteredComboCount(
        pool,
        { mode: "none" },
        {
          constraints: constraints.map((row) =>
            row.stat === "Grenade" ? { ...row, min: maxGrenade + 1 } : row,
          ),
          assumedMods: { majorCount: 5, slotFill: true, artifice: true },
          cap: 1,
        },
      ).count,
    ).toBe(0);
  });

  it("stays bounded on large pools when visitCap is set", () => {
    const pool: ReturnType<typeof mockPiece>[] = [];
    for (const slot of SLOT_ORDER) {
      for (let i = 0; i < 25; i++) {
        pool.push(
          mockPiece(slot, `${slot}-${i}`, {
            Weapons: 5 + i,
            Health: 3 + i * 2,
            Grenade: 4 + i * 3,
            Melee: 2 + i,
            Class: 1 + i,
            Super: 3 + i * 2,
          }),
        );
      }
    }
    const constraints = ARMOR_STAT_NAMES.map((stat) => ({
      stat,
      min:
        stat === "Weapons" ? 200 : stat === "Grenade" ? 100 : stat === "Super" ? 100 : 0,
    }));

    const t0 = performance.now();
    const capped = maxFeasibleStatTarget(
      pool,
      { mode: "none" },
      constraints,
      "Weapons",
      { assumedMods: { majorCount: 3, slotFill: true }, feasibilityVisitCap: 500 },
    );
    const elapsed = performance.now() - t0;

    expect(capped).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(500);
  });
});
