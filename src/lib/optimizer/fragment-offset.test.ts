import { describe, expect, it } from "vitest";
import { computeFragmentStatOffset } from "@/lib/optimizer/fragment-offset";
import { MOCK_OPTIMIZER_LOOKUP } from "../../../.storybook/mocks/optimizer-lookup";

describe("computeFragmentStatOffset", () => {
  it("sums deltas for selected fragment plugs", () => {
    const offset = computeFragmentStatOffset([1001, 1002], MOCK_OPTIMIZER_LOOKUP);
    expect(offset.Grenade).toBe(10);
    expect(offset.Weapons).toBe(10);
    expect(offset.Melee).toBe(-10);
  });
});
