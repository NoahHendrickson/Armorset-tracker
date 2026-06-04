import { scoreSolution } from "@/lib/optimizer/constraints";
import { solutionSignature } from "@/lib/optimizer/signature";
import type { OptimizerSolution, StatConstraintRow } from "@/lib/optimizer/types";

/** Merge shard worker results into a deduped top-N list. */
export function mergeOptimizerSolutions(
  shardResults: OptimizerSolution[][],
  constraints: StatConstraintRow[],
  topN: number,
): OptimizerSolution[] {
  const merged = shardResults.flat();
  merged.sort(
    (a, b) => scoreSolution(a.totals, constraints) - scoreSolution(b.totals, constraints),
  );

  const seen = new Set<string>();
  const out: OptimizerSolution[] = [];
  for (const solution of merged) {
    const key = `${solution.signature}:${Object.values(solution.slots).join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(solution);
    if (out.length >= topN) break;
  }
  return out;
}

export function dedupeSolutionList(
  solutions: OptimizerSolution[],
): OptimizerSolution[] {
  const seen = new Set<string>();
  const out: OptimizerSolution[] = [];
  for (const solution of solutions) {
    const key = solutionSignature(solution.totals);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(solution);
  }
  return out;
}
