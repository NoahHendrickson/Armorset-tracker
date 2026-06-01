import { describe, expect, it } from "vitest";
import {
  computeAssumedModStatOffset,
  MAJOR_ARMOR_STAT_MOD,
  MINOR_ARMOR_STAT_MOD,
} from "@/lib/optimizer/mod-offset";

describe("computeAssumedModStatOffset", () => {
  it("returns zero when no mods are assumed", () => {
    const offset = computeAssumedModStatOffset({ major: false, minor: false });
    expect(offset.Weapons).toBe(0);
    expect(offset.Grenade).toBe(0);
  });

  it("adds major mod budget per piece", () => {
    const offset = computeAssumedModStatOffset({ major: true, minor: false });
    expect(offset.Weapons).toBe(MAJOR_ARMOR_STAT_MOD * 5);
  });

  it("stacks major and minor per piece", () => {
    const offset = computeAssumedModStatOffset({ major: true, minor: true });
    expect(offset.Weapons).toBe((MAJOR_ARMOR_STAT_MOD + MINOR_ARMOR_STAT_MOD) * 5);
  });
});
