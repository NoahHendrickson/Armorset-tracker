import { describe, expect, it } from "vitest";
import { SolutionHeap } from "@/lib/optimizer/solution-heap";
import type { OptimizerSolution } from "@/lib/optimizer/types";

function mockSolution(score: number): OptimizerSolution {
  return {
    slots: {
      helmet: `h-${score}`,
      arms: "a",
      chest: "c",
      legs: "l",
      classItem: "ci",
    },
    totals: {
      Weapons: score,
      Health: 0,
      Class: 0,
      Grenade: 0,
      Melee: 0,
      Super: 0,
    },
    signature: String(score),
  };
}

describe("SolutionHeap", () => {
  it("keeps only the best N solutions by score", () => {
    const heap = new SolutionHeap(2, (s) => s.totals.Weapons);
    heap.insert(mockSolution(10));
    heap.insert(mockSolution(5));
    heap.insert(mockSolution(20));
    heap.insert(mockSolution(3));
    const sorted = heap.toSortedArray();
    expect(sorted.map((s) => s.totals.Weapons)).toEqual([3, 5]);
  });

  it("couldInsert rejects worse than the current worst", () => {
    const heap = new SolutionHeap(2, (s) => s.totals.Weapons);
    heap.insert(mockSolution(1));
    heap.insert(mockSolution(5));
    expect(heap.couldInsert(3)).toBe(true);
    expect(heap.couldInsert(10)).toBe(false);
  });
});
