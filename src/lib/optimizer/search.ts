import { SLOT_ORDER } from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES } from "@/lib/db/types";
import { estimateFilteredComboCount } from "@/lib/optimizer/combo-count";
import {
  hasStatTargets,
  scoreSolution,
  totalsFromPieces,
} from "@/lib/optimizer/constraints";
import { enumerateLoadouts } from "@/lib/optimizer/enumeration/enumerate-loadouts";
import { prepareDedupedSlotPool } from "@/lib/optimizer/enumeration/prepare-slot-pool";
import { DEFAULT_EXOTIC_LOCK } from "@/lib/optimizer/exotic-lock";
import { addStatOffsets } from "@/lib/optimizer/fragment-offset";
import { DEFAULT_ASSUMED_STAT_MODS } from "@/lib/optimizer/mod-offset";
import { resolveLoadoutTotals } from "@/lib/optimizer/resolve-loadout-totals";
import { satisfiesSetBonuses } from "@/lib/optimizer/set-bonus";
import { solutionSignature } from "@/lib/optimizer/signature";
import { SolutionHeap } from "@/lib/optimizer/solution-heap";
import type { OptimizerRequest, OptimizerSolution } from "@/lib/optimizer/types";

export function searchLoadouts(
  request: OptimizerRequest,
  onProgress?: (percent: number) => void,
  isCancelled?: () => boolean,
): OptimizerSolution[] {
  const topN = request.topN ?? 20;
  const exoticLock = request.exoticLock ?? DEFAULT_EXOTIC_LOCK;
  const setBonusSelections = request.setBonusSelections ?? [];
  const assumedMods = request.assumedStatMods ?? DEFAULT_ASSUMED_STAT_MODS;
  const fragmentOffset = request.statOffset ?? {};

  if (
    !hasStatTargets(request.constraints) &&
    setBonusSelections.length === 0
  ) {
    onProgress?.(100);
    return [];
  }

  if (
    hasStatTargets(request.constraints) ||
    setBonusSelections.length > 0
  ) {
    const { count: anyFeasible } = estimateFilteredComboCount(
      request.pool,
      exoticLock,
      {
        constraints: request.constraints,
        setBonusSelections,
        statOffset: fragmentOffset,
        assumedMods,
        cap: 1,
      },
    );
    if (anyFeasible === 0) {
      onProgress?.(100);
      return [];
    }
  }

  const prepared = prepareDedupedSlotPool({
    pool: request.pool,
    exoticLock,
    pinnedInstanceIds: new Set(request.pinnedInstanceIds ?? []),
    excludedInstanceIds: new Set(request.excludedInstanceIds ?? []),
  });
  if (prepared == null) {
    return [];
  }

  const zeroTotals = totalsFromPieces([]);
  const startTotals =
    Object.keys(fragmentOffset).length > 0
      ? addStatOffsets(
          zeroTotals,
          fragmentOffset as Record<(typeof ARMOR_STAT_NAMES)[number], number>,
        )
      : zeroTotals;

  const heap = new SolutionHeap(topN * 4, (solution) =>
    scoreSolution(solution.totals, request.constraints),
  );

  enumerateLoadouts({
    prepared,
    exoticLock,
    startTotals,
    constraints: request.constraints,
    assumedMods,
    setBonusSelections,
    shard: request.shard,
    isCancelled,
    onVisitBatch: (visited, totalCombos) => {
      onProgress?.(
        totalCombos > 0 ? Math.min(99, (visited / totalCombos) * 100) : 0,
      );
    },
    onLeaf: (chosen) => {
      if (!satisfiesSetBonuses(chosen, setBonusSelections)) {
        return "reject";
      }
      const resolved = resolveLoadoutTotals(
        chosen,
        request.constraints,
        fragmentOffset,
        assumedMods,
      );
      if (resolved == null) {
        return "reject";
      }
      const solutionScore = scoreSolution(
        resolved.totals,
        request.constraints,
      );
      if (!heap.couldInsert(solutionScore)) {
        return "reject";
      }
      const slots = Object.fromEntries(
        chosen.map((piece, index) => [SLOT_ORDER[index]!, piece.itemInstanceId]),
      ) as OptimizerSolution["slots"];
      const interchangeable = Object.fromEntries(
        chosen.map((piece, index) => [
          SLOT_ORDER[index]!,
          prepared.membersByInstanceId.get(piece.itemInstanceId) ?? [
            piece.itemInstanceId,
          ],
        ]),
      ) as NonNullable<OptimizerSolution["interchangeable"]>;
      heap.insert({
        slots,
        totals: resolved.totals,
        signature: solutionSignature(resolved.totals),
        interchangeable,
        resolved,
      });
      return "accept";
    },
  });

  onProgress?.(100);

  const candidates = heap.toSortedArray();

  const seen = new Set<string>();
  const out: OptimizerSolution[] = [];
  for (const solution of candidates) {
    const key = `${solution.signature}:${Object.values(solution.slots).join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(solution);
    if (out.length >= topN) break;
  }
  return out;
}
