import type { ArmorStatName } from "@/lib/db/types";
import { buildStatTotals } from "@/lib/inventory/compute-stat-totals";
import type {
  ManifestInventoryItemDefinition,
  ManifestPlugSetDefinition,
} from "@/lib/manifest/types";

type InvestmentStat = {
  statTypeHash: number;
  value?: number;
  isConditionallyActive?: boolean;
};

type StatDelta = { stat: ArmorStatName; value: number };

export type ExoticSocketBudgetMaps = {
  statPlugs: Map<number, StatDelta>;
  tuningPlugStats: Map<number, StatDelta[]>;
  plugToTuning: Map<number, number>;
};

export type ExoticSocketBudgetContext = ExoticSocketBudgetMaps & {
  items?: Record<string, ManifestInventoryItemDefinition>;
  statNameByHash?: Map<number, ArmorStatName>;
  plugSets?: Record<string, ManifestPlugSetDefinition>;
};

function plugHashesForSocketEntry(
  entry: NonNullable<
    ManifestInventoryItemDefinition["sockets"]
  >["socketEntries"][number],
  plugSets?: Record<string, ManifestPlugSetDefinition>,
): number[] {
  if (entry.singleInitialItemHash) {
    return [entry.singleInitialItemHash];
  }
  const hashes: number[] = [];
  for (const setHash of [
    entry.reusablePlugSetHash,
    entry.randomizedPlugSetHash,
  ]) {
    if (!setHash || !plugSets) continue;
    const set = plugSets[String(setHash)];
    for (const plug of set?.reusablePlugItems ?? []) {
      if (plug.plugItemHash) hashes.push(plug.plugItemHash);
    }
  }
  return [...new Set(hashes)];
}

function statDeltasFromPlugItem(
  plugHash: number,
  ctx: ExoticSocketBudgetContext,
): StatDelta[] {
  const fromMap = ctx.statPlugs.get(plugHash);
  if (fromMap) return [fromMap];

  if (!ctx.items || !ctx.statNameByHash) return [];

  const plugItem = ctx.items[String(plugHash)];
  if (!plugItem) return [];

  const deltas: StatDelta[] = [];
  for (const inv of plugItem.investmentStats ?? []) {
    if (inv.isConditionallyActive) continue;
    const stat = ctx.statNameByHash.get(inv.statTypeHash);
    const value = inv.value ?? 0;
    if (!stat || value === 0) continue;
    deltas.push({ stat, value });
  }
  return deltas;
}

/** Sum manifest investmentStats into Armor 3.0 stat totals (exotic base rolls). */
export function investmentStatsToStatTotals(
  investmentStats: InvestmentStat[] | undefined,
  statNameByHash: Map<number, ArmorStatName>,
): Partial<Record<ArmorStatName, number>> {
  const totals: Partial<Record<ArmorStatName, number>> = {};
  for (const inv of investmentStats ?? []) {
    if (inv.isConditionallyActive) continue;
    const stat = statNameByHash.get(inv.statTypeHash);
    const value = inv.value ?? 0;
    if (!stat || value === 0) continue;
    totals[stat] = (totals[stat] ?? 0) + value;
  }
  return totals;
}

export function mergeExoticStatTotals(
  ...sources: Array<Partial<Record<ArmorStatName, number>>>
): Partial<Record<ArmorStatName, number>> {
  const merged: Partial<Record<ArmorStatName, number>> = {};
  for (const source of sources) {
    for (const [stat, value] of Object.entries(source) as Array<
      [ArmorStatName, number]
    >) {
      if (value == null || value === 0) continue;
      const existing = merged[stat];
      if (existing === undefined) {
        merged[stat] = value;
        continue;
      }
      // Weapons budget varies by roll — keep the higher candidate.
      // Other stats: prefer the lower socket-derived value over inflated
      // investmentStats (matches D2ArmorPicker piece rows).
      merged[stat] =
        stat === "Weapons" ? Math.max(existing, value) : Math.min(existing, value);
    }
  }
  return merged;
}

/**
 * Default roll from the item definition's socket templates (Armor 3.0 exotics
 * often have empty `investmentStats` on the item but stats on intrinsic plugs).
 * Walks `singleInitialItemHash` and reusable/randomized plug sets.
 */
export function exoticStatBudgetFromItemSockets(
  item: ManifestInventoryItemDefinition,
  ctx: ExoticSocketBudgetContext,
): Partial<Record<ArmorStatName, number>> {
  const intrinsicByStat = new Map<ArmorStatName, number>();
  let tuningDeltas: StatDelta[] = [];

  for (const entry of item.sockets?.socketEntries ?? []) {
    const plugHashes = plugHashesForSocketEntry(entry, ctx.plugSets);

    for (const plugHash of plugHashes) {
      if (ctx.plugToTuning.has(plugHash)) {
        const deltas = ctx.tuningPlugStats.get(plugHash);
        if (deltas && deltas.length > 0) tuningDeltas = deltas;
      }

      for (const delta of statDeltasFromPlugItem(plugHash, ctx)) {
        if (delta.value <= 0) continue;
        const existing = intrinsicByStat.get(delta.stat) ?? 0;
        if (delta.value > existing) intrinsicByStat.set(delta.stat, delta.value);
      }
    }
  }

  const intrinsic = [...intrinsicByStat.entries()].map(([stat, value]) => ({
    stat,
    value,
  }));

  if (intrinsic.length === 0 && tuningDeltas.length === 0) {
    return {};
  }

  return buildStatTotals(intrinsic, tuningDeltas);
}
