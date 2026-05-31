import { describe, expect, it } from "vitest";
import {
  inventoryPieceMatchesSetSearch,
  looseInventoryNameMatch,
  tokenizeInventorySearchQuery,
} from "@/lib/filters/inventory-set-search";
import type { DerivedArmorPieceJson } from "@/lib/db/types";

function piece(displayName: string): DerivedArmorPieceJson {
  return {
    itemInstanceId: "x",
    itemHash: 1,
    slot: "helmet",
    classType: 0,
    setHash: 1,
    setName: displayName,
    displayName,
    location: { kind: "vault" },
  };
}

describe("tokenizeInventorySearchQuery", () => {
  it("splits on whitespace and lowercases", () => {
    expect(tokenizeInventorySearchQuery("  Ferro   Smoke ")).toEqual([
      "ferro",
      "smoke",
    ]);
  });
});

describe("looseInventoryNameMatch", () => {
  it("matches prefix substrings", () => {
    expect(looseInventoryNameMatch("ferro", "Ferropotent")).toBe(true);
    expect(looseInventoryNameMatch("smoke", "Smokejumper")).toBe(true);
  });

  it("matches ordered subsequence for partial typing", () => {
    expect(looseInventoryNameMatch("frpot", "Ferropotent")).toBe(true);
  });

  it("rejects unrelated names", () => {
    expect(looseInventoryNameMatch("ferro", "Smokejumper")).toBe(false);
  });
});

describe("inventoryPieceMatchesSetSearch", () => {
  it("ORs tokens across display names", () => {
    const ferro = piece("Ferropotent");
    const smoke = piece("Smokejumper");
    const other = piece("Iron Will Suit");
    const tokens = tokenizeInventorySearchQuery("ferro smoke");
    expect(inventoryPieceMatchesSetSearch(ferro, tokens)).toBe(true);
    expect(inventoryPieceMatchesSetSearch(smoke, tokens)).toBe(true);
    expect(inventoryPieceMatchesSetSearch(other, tokens)).toBe(false);
  });
});
