import { SLOT_ORDER } from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES, type DerivedArmorPieceJson } from "@/lib/db/types";
import { getPieceStatCeiling } from "@/lib/inventory/compute-stat-totals";
import {
  partialCanReachMins,
  satisfiesConstraints,
  scoreSolution,
  totalsFromPieces,
} from "@/lib/optimizer/constraints";
import { dedupeSlotPieces } from "@/lib/optimizer/dedupe";
import {
  applyExoticLockToSlotGroups,
  countExoticsInPieces,
  DEFAULT_EXOTIC_LOCK,
  exoticAllowedInPartialCombo,
  resolveLockedExoticIdentityKey,
} from "@/lib/optimizer/exotic-lock";
import { addStatOffsets } from "@/lib/optimizer/fragment-offset";
import {
  partialCanSatisfySetBonuses,
  satisfiesSetBonuses,
} from "@/lib/optimizer/set-bonus";
import { solutionSignature } from "@/lib/optimizer/signature";
import type { OptimizerRequest, OptimizerSolution } from "@/lib/optimizer/types";

function groupPoolBySlot(pool: DerivedArmorPieceJson[]) {
  const bySlot = new Map<
    DerivedArmorPieceJson["slot"],
    DerivedArmorPieceJson[]
  >();
  for (const slot of SLOT_ORDER) {
    bySlot.set(slot, []);
  }
  for (const piece of pool) {
    bySlot.get(piece.slot)?.push(piece);
  }
  return bySlot;
}

function perSlotMaxima(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
): Record<(typeof ARMOR_STAT_NAMES)[number], number> {
  const maxima = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, 0]),
  ) as Record<(typeof ARMOR_STAT_NAMES)[number], number>;
  for (const slot of SLOT_ORDER) {
    for (const piece of bySlot.get(slot) ?? []) {
      for (const stat of ARMOR_STAT_NAMES) {
        maxima[stat] = Math.max(maxima[stat], getPieceStatCeiling(piece, stat));
      }
    }
  }
  return maxima;
}

export function searchLoadouts(
  request: OptimizerRequest,
  onProgress?: (percent: number) => void,
  isCancelled?: () => boolean,
): OptimizerSolution[] {
  const topN = request.topN ?? 20;
  const exoticLock = request.exoticLock ?? DEFAULT_EXOTIC_LOCK;
  const setBonusSelections = request.setBonusSelections ?? [];
  const bySlot = groupPoolBySlot(request.pool);
  const lockedIdentityKey = resolveLockedExoticIdentityKey(
    exoticLock,
    request.pool,
  );
  applyExoticLockToSlotGroups(bySlot, exoticLock, request.pool);
  for (const slot of SLOT_ORDER) {
    if ((bySlot.get(slot)?.length ?? 0) === 0) return [];
  }

  const pinned = new Set(request.pinnedInstanceIds ?? []);
  const excluded = new Set(request.excludedInstanceIds ?? []);
  for (const slot of SLOT_ORDER) {
    bySlot.set(
      slot,
      (bySlot.get(slot) ?? []).filter(
        (p) => !excluded.has(p.itemInstanceId),
      ),
    );
    if (pinned.size > 0) {
      const pinnedForSlot = (bySlot.get(slot) ?? []).filter((p) =>
        pinned.has(p.itemInstanceId),
      );
      if (pinnedForSlot.length > 1) return [];
      if (pinnedForSlot.length === 1) {
        bySlot.set(slot, pinnedForSlot);
      }
    }
  }

  // Collapse interchangeable pieces (same stats + set + rarity) to one
  // representative per slot before enumerating — the main large-vault speedup.
  const membersByInstanceId = new Map<string, string[]>();
  for (const slot of SLOT_ORDER) {
    const { representatives, membersByRepresentative } = dedupeSlotPieces(
      bySlot.get(slot) ?? [],
    );
    bySlot.set(slot, representatives);
    for (const [repId, members] of membersByRepresentative) {
      membersByInstanceId.set(repId, members);
    }
  }

  const perSlotMax = perSlotMaxima(bySlot);
  const slotPieces = SLOT_ORDER.map((slot) => bySlot.get(slot) ?? []);
  const totalCombos =
    slotPieces[0]!.length *
    slotPieces[1]!.length *
    slotPieces[2]!.length *
    slotPieces[3]!.length *
    slotPieces[4]!.length;
  let visited = 0;

  const candidates: OptimizerSolution[] = [];

  const visit = (
    slotIndex: number,
    chosen: DerivedArmorPieceJson[],
    partialTotals: ReturnType<typeof totalsFromPieces>,
  ) => {
    if (isCancelled?.()) return;
    if (slotIndex >= SLOT_ORDER.length) {
      if (exoticLock.mode === "any" && countExoticsInPieces(chosen) > 1) {
        return;
      }
      if (!satisfiesSetBonuses(chosen, setBonusSelections)) {
        return;
      }
      if (satisfiesConstraints(partialTotals, request.constraints)) {
        const slots = Object.fromEntries(
          chosen.map((piece, i) => [SLOT_ORDER[i]!, piece.itemInstanceId]),
        ) as OptimizerSolution["slots"];
        const interchangeable = Object.fromEntries(
          chosen.map((piece, i) => [
            SLOT_ORDER[i]!,
            membersByInstanceId.get(piece.itemInstanceId) ?? [
              piece.itemInstanceId,
            ],
          ]),
        ) as NonNullable<OptimizerSolution["interchangeable"]>;
        candidates.push({
          slots,
          totals: partialTotals,
          signature: solutionSignature(partialTotals),
          interchangeable,
        });
      }
      return;
    }

    const remaining = SLOT_ORDER.length - slotIndex;
    const remainingSlots = SLOT_ORDER.slice(slotIndex);
    for (const piece of slotPieces[slotIndex] ?? []) {
      if (
        !exoticAllowedInPartialCombo(
          piece,
          chosen,
          exoticLock,
          lockedIdentityKey,
        )
      ) {
        continue;
      }
      visited += 1;
      if (visited % 5000 === 0) {
        onProgress?.(
          totalCombos > 0 ? Math.min(99, (visited / totalCombos) * 100) : 0,
        );
      }
      const nextTotals = { ...partialTotals };
      for (const stat of ARMOR_STAT_NAMES) {
        nextTotals[stat] += getPieceStatCeiling(piece, stat);
      }
      if (
        !partialCanReachMins(
          nextTotals,
          remaining - 1,
          perSlotMax,
          request.constraints,
        )
      ) {
        continue;
      }
      if (
        !partialCanSatisfySetBonuses(
          [...chosen, piece],
          remainingSlots.slice(1),
          bySlot,
          setBonusSelections,
        )
      ) {
        continue;
      }
      visit(slotIndex + 1, [...chosen, piece], nextTotals);
    }
  };

  const zeroTotals = totalsFromPieces([]);
  const startTotals =
    request.statOffset && Object.keys(request.statOffset).length > 0
      ? addStatOffsets(
          zeroTotals,
          request.statOffset as Record<(typeof ARMOR_STAT_NAMES)[number], number>,
        )
      : zeroTotals;
  visit(0, [], startTotals);
  onProgress?.(100);

  candidates.sort(
    (a, b) =>
      scoreSolution(a.totals, request.constraints) -
      scoreSolution(b.totals, request.constraints),
  );

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
