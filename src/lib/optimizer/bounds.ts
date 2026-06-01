import { SLOT_ORDER } from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES } from "@/lib/db/types";
import {
  getPieceStatCeiling,
  getPieceStatValue,
} from "@/lib/inventory/compute-stat-totals";
import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import {
  hasStatTargets,
  isActiveStatConstraint,
  otherActiveStatConstraints,
  partialCanReachMins,
  satisfiesOtherStatConstraints,
  totalsFromPieces,
} from "@/lib/optimizer/constraints";
import { dedupeSlotPieces } from "@/lib/optimizer/dedupe";
import { addStatOffsets } from "@/lib/optimizer/fragment-offset";
import {
  DEFAULT_ASSUMED_STAT_MODS,
  totalAssumedModBudget,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import {
  resolveLoadoutStatExtremum,
  resolveLoadoutTotals,
} from "@/lib/optimizer/resolve-loadout-totals";
import {
  estimateFilteredComboCount,
  maxFeasibleStatTarget,
} from "@/lib/optimizer/combo-count";
import {
  partialCanSatisfySetBonuses,
  type SetBonusSelection,
} from "@/lib/optimizer/set-bonus";
import {
  applyExoticLockToSlotGroups,
  countExoticsInPieces,
  DEFAULT_EXOTIC_LOCK,
  exoticAllowedInPartialCombo,
  pieceMatchesLockedExotic,
  resolveLockedExoticIdentityKey,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import type { StatBounds, StatConstraintRow } from "@/lib/optimizer/types";

function emptyBounds(): StatBounds {
  return Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, { min: 0, max: 0 }]),
  ) as StatBounds;
}

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

/** Best stat in a slot; prefers legendaries, falls back to exotics when alone in slot. */
function slotStatExtremum(
  pieces: DerivedArmorPieceJson[],
  stat: (typeof ARMOR_STAT_NAMES)[number],
  mode: "min" | "max",
): number | null {
  const legendaries = pieces.filter((p) => !p.isExotic);
  const candidates = legendaries.length > 0 ? legendaries : pieces;
  let result = mode === "min" ? Infinity : -Infinity;
  for (const piece of candidates) {
    const value =
      mode === "min"
        ? getPieceStatValue(piece, stat)
        : getPieceStatCeiling(piece, stat);
    result = mode === "min" ? Math.min(result, value) : Math.max(result, value);
  }
  return Number.isFinite(result) ? result : null;
}

function sumSlotExtrema(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
  stat: (typeof ARMOR_STAT_NAMES)[number],
  mode: "min" | "max",
): number | null {
  let total = 0;
  for (const slot of SLOT_ORDER) {
    const value = slotStatExtremum(bySlot.get(slot) ?? [], stat, mode);
    if (value == null) return null;
    total += value;
  }
  return total;
}

/** Max achievable stat total respecting the one-exotic loadout rule. */
function maxTotalForStat(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
  stat: (typeof ARMOR_STAT_NAMES)[number],
  exoticLock: ExoticLock,
): number | null {
  if (exoticLock.mode === "none") {
    return sumSlotExtrema(bySlot, stat, "max");
  }

  if (exoticLock.mode === "locked") {
    const flat = [...bySlot.values()].flat();
    const identityKey = resolveLockedExoticIdentityKey(exoticLock, flat);
    const lockedPieces = (bySlot.get(exoticLock.slot) ?? []).filter((piece) =>
      identityKey
        ? pieceMatchesLockedExotic(piece, exoticLock, identityKey)
        : piece.itemInstanceId === exoticLock.itemInstanceId,
    );
    if (lockedPieces.length === 0) return null;

    let total = Math.max(
      ...lockedPieces.map((piece) => getPieceStatCeiling(piece, stat)),
    );
    for (const slot of SLOT_ORDER) {
      if (slot === exoticLock.slot) continue;
      const slotMax = slotStatExtremum(bySlot.get(slot) ?? [], stat, "max");
      if (slotMax == null) return null;
      total += slotMax;
    }
    return total;
  }

  let best = sumSlotExtrema(bySlot, stat, "max");
  if (best == null) return null;

  for (const slot of SLOT_ORDER) {
    for (const piece of bySlot.get(slot) ?? []) {
      if (!piece.isExotic) continue;
      let total = getPieceStatCeiling(piece, stat);
      for (const otherSlot of SLOT_ORDER) {
        if (otherSlot === slot) continue;
        const slotMax = slotStatExtremum(bySlot.get(otherSlot) ?? [], stat, "max");
        if (slotMax == null) return null;
        total += slotMax;
      }
      best = Math.max(best, total);
    }
  }
  return best;
}

/** Min achievable stat total under the exotic lock (conservative, all-legendary floor). */
function minTotalForStat(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
  stat: (typeof ARMOR_STAT_NAMES)[number],
  exoticLock: ExoticLock,
): number | null {
  if (exoticLock.mode === "locked") {
    const flat = [...bySlot.values()].flat();
    const identityKey = resolveLockedExoticIdentityKey(exoticLock, flat);
    const lockedPieces = (bySlot.get(exoticLock.slot) ?? []).filter((piece) =>
      identityKey
        ? pieceMatchesLockedExotic(piece, exoticLock, identityKey)
        : piece.itemInstanceId === exoticLock.itemInstanceId,
    );
    if (lockedPieces.length === 0) return null;

    let total = Math.min(
      ...lockedPieces.map((piece) => getPieceStatValue(piece, stat)),
    );
    for (const slot of SLOT_ORDER) {
      if (slot === exoticLock.slot) continue;
      const slotMin = slotStatExtremum(bySlot.get(slot) ?? [], stat, "min");
      if (slotMin == null) return null;
      total += slotMin;
    }
    return total;
  }

  return sumSlotExtrema(bySlot, stat, "min");
}

function applyFragmentOffsetToBounds(
  bounds: StatBounds,
  statOffset?: Partial<Record<ArmorStatName, number>>,
): StatBounds {
  if (!statOffset || Object.keys(statOffset).length === 0) {
    return bounds;
  }
  const zero = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, 0]),
  ) as Record<ArmorStatName, number>;
  const offset = addStatOffsets(
    zero,
    statOffset as Record<ArmorStatName, number>,
  );
  for (const stat of ARMOR_STAT_NAMES) {
    bounds[stat] = {
      min: bounds[stat].min + (offset[stat] ?? 0),
      max: bounds[stat].max + (offset[stat] ?? 0),
    };
  }
  return bounds;
}

/** Adds the shared mod pool to each stat's max (mods can stack on one stat). */
function applyModBudgetToBounds(
  bounds: StatBounds,
  assumedMods: AssumedStatMods = DEFAULT_ASSUMED_STAT_MODS,
): StatBounds {
  const modTotal = totalAssumedModBudget(assumedMods).total;
  if (modTotal === 0) {
    return bounds;
  }
  for (const stat of ARMOR_STAT_NAMES) {
    bounds[stat] = {
      min: bounds[stat].min,
      max: bounds[stat].max + modTotal,
    };
  }
  return bounds;
}

/** @deprecated Use applyFragmentOffsetToBounds + applyModBudgetToBounds. */
function applyStatOffsetToBounds(
  bounds: StatBounds,
  statOffset?: Partial<Record<ArmorStatName, number>>,
): StatBounds {
  return applyFragmentOffsetToBounds(bounds, statOffset);
}

function independentStatBounds(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
  exoticLock: ExoticLock,
): StatBounds | null {
  const bounds = emptyBounds();
  for (const stat of ARMOR_STAT_NAMES) {
    const minTotal = minTotalForStat(bySlot, stat, exoticLock);
    const maxTotal = maxTotalForStat(bySlot, stat, exoticLock);
    if (minTotal == null || maxTotal == null) {
      return null;
    }
    bounds[stat] = { min: minTotal, max: maxTotal };
  }
  return bounds;
}

function perSlotMaxima(
  bySlot: Map<DerivedArmorPieceJson["slot"], DerivedArmorPieceJson[]>,
): Record<ArmorStatName, number> {
  const maxima = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, 0]),
  ) as Record<ArmorStatName, number>;
  for (const slot of SLOT_ORDER) {
    for (const piece of bySlot.get(slot) ?? []) {
      for (const stat of ARMOR_STAT_NAMES) {
        maxima[stat] = Math.max(maxima[stat], getPieceStatCeiling(piece, stat));
      }
    }
  }
  return maxima;
}

/** Joint slider bands disabled on the hot path (see useStatBoundsForSliders). */
export const JOINT_BOUNDS_COMBO_LIMIT = 0;

/** Above this deduped combo count, auto-search is skipped (manual run TBD). */
export const SEARCH_AUTO_RUN_COMBO_LIMIT = 50_000;

/** Deduped representative count for one slot's candidate list. */
function dedupedRepresentativeCount(pieces: DerivedArmorPieceJson[]): number {
  if (pieces.length === 0) return 0;
  return dedupeSlotPieces(pieces).representatives.length;
}

function productSlotCounts(
  slotPieces: Map<
    DerivedArmorPieceJson["slot"],
    DerivedArmorPieceJson[]
  >,
): number {
  let product = 1;
  for (const slot of SLOT_ORDER) {
    const count = dedupedRepresentativeCount(slotPieces.get(slot) ?? []);
    if (count === 0) return 0;
    product *= count;
  }
  return product;
}

/**
 * Deduped five-slot combination count (same shaping as search / joint bounds).
 * Respects exotic lock rules: none = no exotics, locked = one pinned exotic,
 * any = at most one exotic anywhere in the loadout (not one per slot).
 */
export function estimateOptimizerComboCount(
  pool: DerivedArmorPieceJson[],
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
): number {
  const bySlot = groupPoolBySlot(pool);

  if (exoticLock.mode === "none" || exoticLock.mode === "locked") {
    applyExoticLockToSlotGroups(bySlot, exoticLock, pool);
    return productSlotCounts(bySlot);
  }

  // mode === "any" — sum all-legendary loadouts plus one exotic in each slot.
  const legendariesBySlot = new Map<
    DerivedArmorPieceJson["slot"],
    DerivedArmorPieceJson[]
  >();
  for (const slot of SLOT_ORDER) {
    legendariesBySlot.set(
      slot,
      (bySlot.get(slot) ?? []).filter((p) => !p.isExotic),
    );
  }

  let total = productSlotCounts(legendariesBySlot);

  for (const exoticSlot of SLOT_ORDER) {
    const exotics = (bySlot.get(exoticSlot) ?? []).filter((p) => p.isExotic);
    const exoticCount = dedupedRepresentativeCount(exotics);
    if (exoticCount === 0) continue;

    let otherProduct = 1;
    for (const slot of SLOT_ORDER) {
      if (slot === exoticSlot) continue;
      const count = dedupedRepresentativeCount(
        legendariesBySlot.get(slot) ?? [],
      );
      if (count === 0) return total;
      otherProduct *= count;
    }
    total += exoticCount * otherProduct;
  }

  return total;
}

type PreparedSlotPool = {
  slotPieces: DerivedArmorPieceJson[][];
  perSlotMax: Record<ArmorStatName, number>;
  lockedIdentityKey: string | null;
  startTotals: Record<ArmorStatName, number>;
  assumedMods: AssumedStatMods;
};

function prepareSlotPool(
  pool: DerivedArmorPieceJson[],
  statOffset: Partial<Record<ArmorStatName, number>> | undefined,
  exoticLock: ExoticLock,
  assumedMods: AssumedStatMods = DEFAULT_ASSUMED_STAT_MODS,
): PreparedSlotPool | null {
  const bySlot = groupPoolBySlot(pool);
  const lockedIdentityKey = resolveLockedExoticIdentityKey(exoticLock, pool);
  applyExoticLockToSlotGroups(bySlot, exoticLock, pool);

  for (const slot of SLOT_ORDER) {
    if ((bySlot.get(slot)?.length ?? 0) === 0) {
      return null;
    }
    const { representatives } = dedupeSlotPieces(bySlot.get(slot) ?? []);
    bySlot.set(slot, representatives);
  }

  const zeroTotals = totalsFromPieces([]);
  const startTotals =
    statOffset && Object.keys(statOffset).length > 0
      ? addStatOffsets(
          zeroTotals,
          statOffset as Record<ArmorStatName, number>,
        )
      : zeroTotals;

  return {
    slotPieces: SLOT_ORDER.map((slot) => bySlot.get(slot) ?? []),
    perSlotMax: perSlotMaxima(bySlot),
    lockedIdentityKey,
    startTotals,
    assumedMods,
  };
}

function totalsAfterPiece(
  partial: Record<ArmorStatName, number>,
  piece: DerivedArmorPieceJson,
  mode: "min" | "max",
): Record<ArmorStatName, number> {
  const next = { ...partial };
  for (const stat of ARMOR_STAT_NAMES) {
    next[stat] +=
      mode === "max"
        ? getPieceStatCeiling(piece, stat)
        : getPieceStatValue(piece, stat);
  }
  return next;
}

function totalsCeilingAfterPiece(
  partial: Record<ArmorStatName, number>,
  piece: DerivedArmorPieceJson,
): Record<ArmorStatName, number> {
  const next = { ...partial };
  for (const stat of ARMOR_STAT_NAMES) {
    next[stat] += getPieceStatCeiling(piece, stat);
  }
  return next;
}

/**
 * One-pass greedy five-piece build for a stat extrema while honoring other
 * active minimums. Fast O(slots × pieces); tightens gray bands when the full
 * joint enumeration is too large for the vault.
 */
function greedyLoadoutStatExtremum(
  prepared: PreparedSlotPool,
  constraints: StatConstraintRow[],
  exceptStat: ArmorStatName,
  exoticLock: ExoticLock,
  mode: "min" | "max",
  focusStat: ArmorStatName,
  setBonusSelections: SetBonusSelection[] = [],
): number | null {
  const otherConstraints = otherActiveStatConstraints(constraints, exceptStat);
  const slotCandidates = new Map(
    SLOT_ORDER.map((slot, index) => [slot, prepared.slotPieces[index] ?? []]),
  );
  const chosen: DerivedArmorPieceJson[] = [];
  let partial = { ...prepared.startTotals };
  let partialCeiling = { ...prepared.startTotals };

  for (let slotIndex = 0; slotIndex < SLOT_ORDER.length; slotIndex++) {
    const remaining = SLOT_ORDER.length - slotIndex - 1;
    const remainingSlots = SLOT_ORDER.slice(slotIndex + 1);
    let bestPiece: DerivedArmorPieceJson | null = null;
    let bestFocus = mode === "max" ? -Infinity : Infinity;

    for (const piece of prepared.slotPieces[slotIndex] ?? []) {
      if (
        !exoticAllowedInPartialCombo(
          piece,
          chosen,
          exoticLock,
          prepared.lockedIdentityKey,
        )
      ) {
        continue;
      }
      const nextCeiling = totalsCeilingAfterPiece(partialCeiling, piece);
      if (
        !partialCanReachMins(
          nextCeiling,
          remaining,
          prepared.perSlotMax,
          otherConstraints,
          prepared.assumedMods,
        )
      ) {
        continue;
      }
      if (
        !partialCanSatisfySetBonuses(
          [...chosen, piece],
          remainingSlots,
          slotCandidates,
          setBonusSelections,
        )
      ) {
        continue;
      }

      const focusValue =
        mode === "max"
          ? getPieceStatCeiling(piece, focusStat)
          : getPieceStatValue(piece, focusStat);
      if (mode === "max" ? focusValue > bestFocus : focusValue < bestFocus) {
        bestFocus = focusValue;
        bestPiece = piece;
      }
    }

    if (bestPiece == null) {
      return null;
    }

    chosen.push(bestPiece);
    partial = totalsAfterPiece(partial, bestPiece, mode);
    partialCeiling = totalsCeilingAfterPiece(partialCeiling, bestPiece);
  }

  if (exoticLock.mode === "any" && countExoticsInPieces(chosen) > 1) {
    return null;
  }

  const fragmentOffset = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [stat, prepared.startTotals[stat] ?? 0]),
  ) as Partial<Record<ArmorStatName, number>>;

  const extremum = resolveLoadoutStatExtremum(
    chosen,
    otherConstraints,
    fragmentOffset,
    prepared.assumedMods,
    focusStat,
    mode,
  );
  return extremum;
}

/**
 * Fast cross-stat achievable bands (greedy, not exact). Used for slider gray
 * bars on large vaults where joint enumeration is impractical.
 */
export function computeHeuristicConstrainedStatBounds(
  pool: DerivedArmorPieceJson[],
  constraints: StatConstraintRow[],
  statOffset?: Partial<Record<ArmorStatName, number>>,
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
  assumedMods: AssumedStatMods = DEFAULT_ASSUMED_STAT_MODS,
  setBonusSelections: SetBonusSelection[] = [],
): StatBounds | null {
  const prepared = prepareSlotPool(pool, statOffset, exoticLock, assumedMods);
  if (prepared == null) {
    return null;
  }

  const bySlot = groupPoolBySlot(pool);
  const independent = independentStatBounds(bySlot, exoticLock);
  if (independent == null) {
    return null;
  }
  const cloned = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [
      stat,
      { min: independent[stat].min, max: independent[stat].max },
    ]),
  ) as StatBounds;
  let bounds = applyFragmentOffsetToBounds(cloned, statOffset);
  bounds = applyModBudgetToBounds(bounds, assumedMods);
  const independentBounds = Object.fromEntries(
    ARMOR_STAT_NAMES.map((stat) => [
      stat,
      { min: bounds[stat].min, max: bounds[stat].max },
    ]),
  ) as StatBounds;

  for (const stat of ARMOR_STAT_NAMES) {
    const othersActive = otherActiveStatConstraints(constraints, stat);
    const maxVal = greedyLoadoutStatExtremum(
      prepared,
      constraints,
      stat,
      exoticLock,
      "max",
      stat,
      setBonusSelections,
    );
    const minVal = greedyLoadoutStatExtremum(
      prepared,
      constraints,
      stat,
      exoticLock,
      "min",
      stat,
      setBonusSelections,
    );

    let tightenedMax = bounds[stat].max;
    if (maxVal != null) {
      tightenedMax = Math.min(tightenedMax, maxVal);
    }
    if (othersActive.length > 0) {
      const { count: filteredComboCount, capped: filteredComboCapped } =
        estimateFilteredComboCount(pool, exoticLock, {
          constraints,
          setBonusSelections,
          statOffset,
          assumedMods,
          cap: SEARCH_AUTO_RUN_COMBO_LIMIT + 1,
        });
      if (
        !filteredComboCapped &&
        filteredComboCount <= SEARCH_AUTO_RUN_COMBO_LIMIT
      ) {
        tightenedMax = Math.min(
          tightenedMax,
          maxFeasibleStatTarget(pool, exoticLock, constraints, stat, {
            setBonusSelections,
            statOffset,
            assumedMods,
            hi: tightenedMax,
          }),
        );
      }
    }
    bounds[stat].max = tightenedMax;

    if (minVal != null) {
      bounds[stat].min = Math.max(bounds[stat].min, minVal);
    }
    if (bounds[stat].min > bounds[stat].max) {
      const ceiling = maxVal ?? bounds[stat].max;
      const floor = minVal ?? bounds[stat].min;
      bounds[stat] = {
        min: Math.min(floor, ceiling),
        max: Math.max(floor, ceiling),
      };
    }
    if (
      bounds[stat].min === bounds[stat].max &&
      bounds[stat].max > 0 &&
      (maxVal != null || minVal != null)
    ) {
      // Single verified value — widen toward the independent floor for a visible band.
      bounds[stat].min = Math.min(
        independentBounds[stat].min,
        bounds[stat].min,
      );
    }
  }

  return bounds;
}

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
  const bySlot = groupPoolBySlot(pool);
  const lockedIdentityKey = resolveLockedExoticIdentityKey(exoticLock, pool);
  applyExoticLockToSlotGroups(bySlot, exoticLock, pool);

  for (const slot of SLOT_ORDER) {
    if ((bySlot.get(slot)?.length ?? 0) === 0) {
      return null;
    }
    const { representatives } = dedupeSlotPieces(bySlot.get(slot) ?? []);
    bySlot.set(slot, representatives);
  }

  const perSlotMax = perSlotMaxima(bySlot);
  const slotPieces = SLOT_ORDER.map((slot) => bySlot.get(slot) ?? []);
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

/**
 * Achievable min/max per stat from a filtered pool. Respects exotic lock rules
 * (at most one exotic; locked piece fixed to its slot). Powers gray range bars.
 */
export function computeStatBounds(
  pool: DerivedArmorPieceJson[],
  statOffset?: Partial<Record<ArmorStatName, number>>,
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
  constraints?: StatConstraintRow[],
  assumedMods: AssumedStatMods = DEFAULT_ASSUMED_STAT_MODS,
  setBonusSelections: SetBonusSelection[] = [],
): StatBounds {
  const bySlot = groupPoolBySlot(pool);

  for (const slot of SLOT_ORDER) {
    if ((bySlot.get(slot)?.length ?? 0) === 0) {
      return emptyBounds();
    }
  }

  let bounds: StatBounds | null = null;
  if (constraints && hasStatTargets(constraints)) {
    const comboCount = estimateOptimizerComboCount(pool, exoticLock);
    if (comboCount <= JOINT_BOUNDS_COMBO_LIMIT) {
      bounds = jointStatBounds(
        pool,
        constraints,
        statOffset,
        exoticLock,
        assumedMods,
      );
    }
    if (bounds == null) {
      bounds = computeHeuristicConstrainedStatBounds(
        pool,
        constraints,
        statOffset,
        exoticLock,
        assumedMods,
        setBonusSelections,
      );
    }
  }
  if (bounds == null) {
    bounds = independentStatBounds(bySlot, exoticLock);
    bounds = bounds
      ? applyModBudgetToBounds(
          applyFragmentOffsetToBounds(bounds, statOffset),
          assumedMods,
        )
      : null;
  }

  if (bounds == null) {
    return emptyBounds();
  }
  return bounds;
}

/** Fast preflight — false when gray-band max cannot reach an active minimum. */
export function areConstraintsAchievable(
  pool: DerivedArmorPieceJson[],
  constraints: StatConstraintRow[],
  statOffset?: Partial<Record<ArmorStatName, number>>,
  exoticLock: ExoticLock = DEFAULT_EXOTIC_LOCK,
  assumedMods: AssumedStatMods = DEFAULT_ASSUMED_STAT_MODS,
  setBonusSelections: SetBonusSelection[] = [],
): boolean {
  if (!hasStatTargets(constraints)) {
    return true;
  }
  const bounds = computeHeuristicConstrainedStatBounds(
    pool,
    constraints,
    statOffset,
    exoticLock,
    assumedMods,
    setBonusSelections,
  );
  if (bounds == null) {
    return false;
  }
  for (const row of constraints) {
    if (!isActiveStatConstraint(row)) continue;
    if ((bounds[row.stat]?.max ?? 0) < row.min) {
      return false;
    }
  }
  return true;
}
