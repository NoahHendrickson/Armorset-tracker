import type { OptimizerSolution } from "@/lib/optimizer/types";

/**
 * Fixed-size max-heap by score (lower score = better). Mirrors DIM's HeapSetTracker
 * pattern — skip leaf work when a candidate cannot beat the worst kept solution.
 */
export class SolutionHeap {
  private readonly items: OptimizerSolution[] = [];

  constructor(
    private readonly maxSize: number,
    private readonly score: (solution: OptimizerSolution) => number,
  ) {}

  get size(): number {
    return this.items.length;
  }

  couldInsert(score: number): boolean {
    if (this.items.length < this.maxSize) {
      return true;
    }
    return score < this.worstScore();
  }

  insert(solution: OptimizerSolution): void {
    const score = this.score(solution);
    if (!this.couldInsert(score)) {
      return;
    }
    if (this.items.length < this.maxSize) {
      this.items.push(solution);
      this.bubbleUp(this.items.length - 1);
      return;
    }
    this.items[0] = solution;
    this.bubbleDown(0);
  }

  toSortedArray(): OptimizerSolution[] {
    return [...this.items].sort(
      (a, b) => this.score(a) - this.score(b),
    );
  }

  private worstScore(): number {
    return this.score(this.items[0]!);
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.score(this.items[parent]!) >= this.score(this.items[index]!)) {
        break;
      }
      [this.items[parent], this.items[index]] = [
        this.items[index]!,
        this.items[parent]!,
      ];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.items.length;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let largest = index;
      if (
        left < length &&
        this.score(this.items[left]!) > this.score(this.items[largest]!)
      ) {
        largest = left;
      }
      if (
        right < length &&
        this.score(this.items[right]!) > this.score(this.items[largest]!)
      ) {
        largest = right;
      }
      if (largest === index) {
        break;
      }
      [this.items[largest], this.items[index]] = [
        this.items[index]!,
        this.items[largest]!,
      ];
      index = largest;
    }
  }
}
