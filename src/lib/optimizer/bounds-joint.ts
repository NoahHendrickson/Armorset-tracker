import { SLOT_ORDER } from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES, type ArmorStatName, type DerivedArmorPieceJson } from "@/lib/db/types";
import { getPieceStatCeiling } from "@/lib/inventory/compute-stat-totals";
import {
  otherActiveStatConstraints,
  partialCanReachMins,
  satisfiesOtherStatConstraints,
  totalsFromPieces,
} from "@/lib/optimizer/constraints";
import { groupPoolBySlot } from "@/lib/optimizer/enumeration/pool-by-slot";
import { prepareDedupedSlotPool } from "@/lib/optimizer/enumeration/prepare-slot-pool";
import {
  countExoticsInPieces,
  DEFAULT_EXOTIC_LOCK,
  exoticAllowedInPartialCombo,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import { addStatOffsets } from "@/lib/optimizer/fragment-offset";
import {
  applyFragmentOffsetToBounds,
  applyModBudgetToBounds,
  emptyBounds,
  independentStatBounds,
} from "@/lib/optimizer/bounds-independent";
import {
  DEFAULT_ASSUMED_STAT_MODS,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import { resolveLoadoutTotals } from "@/lib/optimizer/resolve-loadout-totals";
import type { StatBounds, StatConstraintRow } from "@/lib/optimizer/types";

/**
 * Joint min/max per stat across real five-piece loadouts, honoring other stats'
 * active minimums (but not this stat's own slider). Matches optimizer search
 * ceilings and exotic rules.
 */
function jointStatBounds(
  pool: DerivedArmorPieceJson[],
  constraints: StatConstraintRow[],
  statOffset: Partial<Record<ArmorStatName, number>> | undefined,
  exoticLock: ExoticLock,
  assumedMods: AssumedStatMods = DEFAULT_ASSUMED_STAT_MODS,
): StatBounds | null {
  const prepared = prepareDedupedSlotPool({ pool, exoticLock });
  if (prepared == null) {
    return null;
  }

  const { slotPieces, perSlotMax, lockedIdentityKey } = prepared;
  const bounds = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [
      stat,
      { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
    ]),
  ) as StatBounds;
  const seen = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, false]),
  ) as Record<ArmorStatName, boolean>;
  let anyFeasible = false;

  const zeroTotals = totalsFromPieces([]);
  const startTotals =
    statOffset && Object.keys(statOffset).length > 0
      ? addStatOffsets(
          zeroTotals,
          statOffset as Record<ArmorStatName, number>,
        )
      : zeroTotals;

  const visit = (
    slotIndex: number,
    chosen: DerivedArmorPieceJson[],
    partialTotals: Record<ArmorStatName, number>,
  ) => {
    if (slotIndex >= SLOT_ORDER.length) {
      if (exoticLock.mode === "any" && countExoticsInPieces(chosen) > 1) {
        return;
      }
      const resolved = resolveLoadoutTotals(
        chosen,
        constraints,
        statOffset ?? {},
        assumedMods,
      );
      if (resolved == null) {
        return;
      }
      for (const stat of ARMOR_STAT_NAMES) {
        if (!satisfiesOtherStatConstraints(resolved.totals, constraints, stat)) {
          continue;
        }
        anyFeasible = true;
        const value = resolved.totals[stat] ?? 0;
        if (!seen[stat]) {
          bounds[stat] = { min: value, max: value };
          seen[stat] = true;
        } else {
          bounds[stat].min = Math.min(bounds[stat].min, value);
          bounds[stat].max = Math.max(bounds[stat].max, value);
        }
      }
      return;
    }

    const remaining = SLOT_ORDER.length - slotIndex - 1;
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
      const nextTotals = { ...partialTotals };
      for (const stat of ARMOR_STAT_NAMES) {
        nextTotals[stat] += getPieceStatCeiling(piece, stat);
      }
      let canExtend = false;
      for (const stat of ARMOR_STAT_NAMES) {
        if (
          partialCanReachMins(
            nextTotals,
            remaining,
            perSlotMax,
            otherActiveStatConstraints(constraints, stat),
            assumedMods,
          )
        ) {
          canExtend = true;
          break;
        }
      }
      if (!canExtend) continue;
      visit(slotIndex + 1, [...chosen, piece], nextTotals);
    }
  };

  visit(0, [], { ...startTotals });

  if (!anyFeasible) {
    return null;
  }
  for (const stat of ARMOR_STAT_NAMES) {
    if (!seen[stat]) {
      bounds[stat] = { min: 0, max: 0 };
    }
  }
  return bounds;
}

/**
 * Joint achievable bands honoring other stats' active minimums. Expensive — not
 * used on the live slider path; kept for tests and future async refinement.
 */
export function computeConstrainedStatBounds(
  pool: DerivedArmorPieceJson[],
  constraints: StatConstraintRow[],
  statOffset?: Partial<Record<ArmorStatName, number>>,
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
  assumedMods: AssumedStatMods = DEFAULT_ASSUMED_STAT_MODS,
): StatBounds {
  const bySlot = groupPoolBySlot(pool);
  for (const slot of SLOT_ORDER) {
    if ((bySlot.get(slot)?.length ?? 0) === 0) {
      return emptyBounds();
    }
  }
  const joint = jointStatBounds(
    pool,
    constraints,
    statOffset,
    exoticLock,
    assumedMods,
  );
  if (joint != null) return joint;
  const independent = independentStatBounds(bySlot, exoticLock);
  if (independent == null) return emptyBounds();
  return applyModBudgetToBounds(
    applyFragmentOffsetToBounds(independent, statOffset),
    assumedMods,
  );
}

/** @internal Used by computeStatBounds when joint enumeration is enabled. */
export { jointStatBounds };
