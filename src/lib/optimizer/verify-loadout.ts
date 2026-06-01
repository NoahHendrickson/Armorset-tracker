import { SLOT_ORDER } from "@/lib/bungie/constants";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import {
  satisfiesConstraints,
  totalsFromPieces,
} from "@/lib/optimizer/constraints";
import { totalAssumedModBudget } from "@/lib/optimizer/mod-offset";
import {
  resolveLoadoutTotals,
  type ResolvedLoadout,
} from "@/lib/optimizer/resolve-loadout-totals";
import {
  satisfiesSetBonuses,
  type SetBonusSelection,
} from "@/lib/optimizer/set-bonus";
import type { StatConstraintRow } from "@/lib/optimizer/types";
import type { AssumedStatMods } from "@/lib/optimizer/mod-offset";
import type { ArmorStatName } from "@/lib/db/types";
import { ARMOR_STAT_NAMES } from "@/lib/db/types";

export type VerifyLoadoutOptions = {
  constraints: StatConstraintRow[];
  fragmentOffset?: Partial<Record<ArmorStatName, number>>;
  assumedMods?: AssumedStatMods;
  setBonusSelections?: SetBonusSelection[];
};

export type VerifyLoadoutResult =
  | { ok: true; resolved: ResolvedLoadout }
  | { ok: false; reason: string };

/**
 * Verify a specific five-piece loadout and return a human-readable failure reason.
 * Useful when debugging “no builds” reports against known armor pieces.
 */
export function verifyLoadout(
  pieces: DerivedArmorPieceJson[],
  options: VerifyLoadoutOptions,
): VerifyLoadoutResult {
  if (pieces.length !== SLOT_ORDER.length) {
    return {
      ok: false,
      reason: `Expected ${SLOT_ORDER.length} pieces (one per slot), got ${pieces.length}.`,
    };
  }

  const slots = new Set(pieces.map((p) => p.slot));
  for (const slot of SLOT_ORDER) {
    if (!slots.has(slot)) {
      return { ok: false, reason: `Missing armor slot: ${slot}.` };
    }
  }

  const setBonusSelections = options.setBonusSelections ?? [];
  if (!satisfiesSetBonuses(pieces, setBonusSelections)) {
    return {
      ok: false,
      reason: "Set bonus piece counts are not met (check setHash on each piece).",
    };
  }

  const assumedMods = options.assumedMods ?? { majorCount: 5 };
  const fragmentOffset = options.fragmentOffset ?? {};
  const budget = totalAssumedModBudget(assumedMods);

  const armorOnly = totalsFromPieces(pieces);
  const resolved = resolveLoadoutTotals(
    pieces,
    options.constraints,
    fragmentOffset,
    assumedMods,
  );

  if (resolved != null) {
    return { ok: true, resolved };
  }

  const lines: string[] = [
    "Could not assign tuning branches and assumed mods to meet all targets.",
    `Armor-only totals (committed rolls): ${formatTotals(armorOnly)}`,
    `Assumed mod budget: +${budget.total} (${budget.majorCount} major, ${budget.minorCount} minor).`,
  ];

  for (const row of options.constraints) {
    if (row.min <= 0) continue;
    const value = armorOnly[row.stat] ?? 0;
    if (value < row.min) {
      lines.push(
        `${row.stat}: armor sum ${value} is below min ${row.min} (needs +${row.min - value} from tuning/mods).`,
      );
    }
  }

  const withFrags = { ...armorOnly };
  for (const stat of ARMOR_STAT_NAMES) {
    withFrags[stat] += fragmentOffset[stat] ?? 0;
  }
  if (!satisfiesConstraints(withFrags, options.constraints)) {
    lines.push(
      `Even ignoring mods, totals violate constraints: ${formatTotals(withFrags)}`,
    );
  }

  return { ok: false, reason: lines.join(" ") };
}

function formatTotals(totals: Record<ArmorStatName, number>): string {
  return ARMOR_STAT_NAMES.map((s) => `${s}=${totals[s] ?? 0}`).join(", ");
}
