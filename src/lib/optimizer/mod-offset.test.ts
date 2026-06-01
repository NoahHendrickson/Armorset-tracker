import { describe, expect, it } from "vitest";
import {
  NO_ASSUMED_STAT_MODS,
  totalAssumedModBudget,
} from "@/lib/optimizer/mod-offset";

describe("totalAssumedModBudget", () => {
  it("returns zero when slot fill is disabled", () => {
    const budget = totalAssumedModBudget(NO_ASSUMED_STAT_MODS);
    expect(budget.total).toBe(0);
  });

  it("fills remaining slots with minor mods when majors are partial", () => {
    const budget = totalAssumedModBudget({ majorCount: 3 });
    expect(budget.majorTotal).toBe(30);
    expect(budget.minorCount).toBe(2);
    expect(budget.minorTotal).toBe(10);
    expect(budget.total).toBe(40);
  });

  it("uses all minor mods when major count is zero", () => {
    const budget = totalAssumedModBudget({ majorCount: 0 });
    expect(budget.majorTotal).toBe(0);
    expect(budget.minorCount).toBe(5);
    expect(budget.total).toBe(25);
  });

  it("uses only major mods when major count is five", () => {
    const budget = totalAssumedModBudget({ majorCount: 5 });
    expect(budget.total).toBe(50);
    expect(budget.minorCount).toBe(0);
  });

  it("does not multiply by active target count", () => {
    const budget = totalAssumedModBudget({ majorCount: 5 });
    expect(budget.total).toBe(50);
    expect(budget.total).not.toBe(50 * 4);
  });
});
