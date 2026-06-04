import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSearchShards } from "@/lib/optimizer/build-search-shards";
import { mockPiece } from "@/lib/optimizer/__fixtures__/pieces";
import { SLOT_ORDER } from "@/lib/bungie/constants";

describe("buildSearchShards", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty shards for tiny pools", () => {
    const pool = SLOT_ORDER.map((slot) =>
      mockPiece(slot, `id-${slot}`, { Weapons: 40 }),
    );
    expect(buildSearchShards(pool)).toEqual([]);
  });

  it("splits the longest slot when the combo space is large", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 4 });
    const pool: ReturnType<typeof mockPiece>[] = [];
    for (let i = 0; i < 30; i++) {
      pool.push(
        mockPiece("helmet", `helmet-${i}`, {
          Weapons: 30 + (i % 7),
          Health: 20 + (i % 5),
        }),
      );
    }
    for (const slot of SLOT_ORDER.slice(1)) {
      for (let i = 0; i < 10; i++) {
        pool.push(
          mockPiece(slot, `${slot}-${i}`, {
            Weapons: 35 + (i % 10),
            Health: 20 + (i % 3),
          }),
        );
      }
    }
    const shards = buildSearchShards(pool);
    expect(shards.length).toBeGreaterThan(1);
    const covered = shards.reduce((sum, s) => sum + (s.pieceEnd - s.pieceStart), 0);
    expect(covered).toBe(30);
    expect(shards.every((s) => s.slotIndex === 0)).toBe(true);
  });
});
