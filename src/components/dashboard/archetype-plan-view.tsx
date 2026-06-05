"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { AssumedStatModsPanel } from "@/components/optimizer/assumed-stat-mods-panel";
import { OptimizerSettingsSection } from "@/components/optimizer/optimizer-settings-section";
import { ArchetypeLoadoutPlanner } from "@/components/plan/archetype-loadout-planner";
import { PlanFragmentSelector } from "@/components/plan/plan-fragment-selector";
import { PlanStatGoalsPicker } from "@/components/plan/plan-stat-goals-picker";
import { TheoreticalStatMaxes } from "@/components/plan/theoretical-stat-maxes";
import { computeFragmentStatOffset } from "@/lib/optimizer/fragment-offset";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import {
  EMPTY_OPTIMIZER_LOOKUP,
  type OptimizerLookupPayload,
} from "@/lib/views/optimizer-lookup-payload";
import type { TrackerFormSelectors } from "@/lib/views/tracker-form-selectors";
import type { GridFilterClass } from "@/lib/workspace/grid-filters-schema";
import {
  buildPlanArchetypeRows,
  initialPlanSelections,
} from "@/lib/plan/build-planner-rows";
import {
  mixedLoadoutBounds,
  type PlanArchetypeSelection,
} from "@/lib/plan/archetype-bounds";
import { LOADOUT_PIECE_COUNT } from "@/lib/plan/constants";
import {
  DEFAULT_PLAN_STAT_GOALS,
  type PlanStatGoals,
} from "@/lib/plan/plan-stat-goals";
import {
  DEFAULT_ASSUMED_STAT_MODS,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import { cn } from "@/lib/utils";

const MAX_PLAN_FRAGMENTS = 5;
/** Match optimizer bounds debounce — keeps piece-count UI responsive. */
const PLAN_BOUNDS_DEBOUNCE_MS = 150;

export type ArchetypePlanViewProps = {
  className?: string;
  banners?: ReactNode;
  syncWarning?: string | null;
  lookupPayload: GridLookupPayload;
  selectors: TrackerFormSelectors;
  optimizerLookup?: OptimizerLookupPayload;
  classType?: GridFilterClass;
};

export function ArchetypePlanView({
  className = "",
  banners,
  syncWarning = null,
  lookupPayload,
  optimizerLookup = EMPTY_OPTIMIZER_LOOKUP,
  classType = 0,
}: ArchetypePlanViewProps) {
  const archetypeRows = useMemo(
    () => buildPlanArchetypeRows(lookupPayload),
    [lookupPayload],
  );

  const [selections, setSelections] = useState<
    Record<string, PlanArchetypeSelection>
  >(() => initialPlanSelections(archetypeRows));

  const [assumedMods, setAssumedMods] =
    useState<AssumedStatMods>(DEFAULT_ASSUMED_STAT_MODS);
  const [statGoals, setStatGoals] = useState<PlanStatGoals>(
    DEFAULT_PLAN_STAT_GOALS,
  );
  const [selectedFragmentHashes, setSelectedFragmentHashes] = useState<
    number[]
  >([]);

  const fragmentStatOffset = useMemo(
    () =>
      computeFragmentStatOffset(
        selectedFragmentHashes,
        optimizerLookup,
        classType,
      ),
    [selectedFragmentHashes, optimizerLookup, classType],
  );

  const toggleFragment = (plugHash: number) => {
    setSelectedFragmentHashes((prev) => {
      const already = prev.includes(plugHash);
      if (already) {
        return prev.filter((h) => h !== plugHash);
      }
      if (prev.length >= MAX_PLAN_FRAGMENTS) {
        return prev;
      }
      return [...prev, plugHash];
    });
  };

  const boundsOptions = useMemo(
    () => ({
      includeMods: true,
      assumedMods,
      statGoals,
      fragmentStatOffset,
    }),
    [assumedMods, statGoals, fragmentStatOffset],
  );

  const debouncedSelections = useDebouncedValue(selections, PLAN_BOUNDS_DEBOUNCE_MS);
  const debouncedBoundsOptions = useDebouncedValue(
    boundsOptions,
    PLAN_BOUNDS_DEBOUNCE_MS,
  );

  const loadoutBounds = useMemo(
    () =>
      mixedLoadoutBounds(
        archetypeRows,
        debouncedSelections,
        debouncedBoundsOptions,
      ),
    [archetypeRows, debouncedSelections, debouncedBoundsOptions],
  );

  const hasTopMessage = Boolean(banners) || Boolean(syncWarning);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {hasTopMessage ? (
        <div className="shrink-0">
          {banners ? (
            <div className="space-y-2 border-b border-border bg-background px-4 py-3 sm:px-6">
              {banners}
            </div>
          ) : null}
          {syncWarning ? (
            <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 sm:px-6">
              <p role="alert" className="text-sm text-destructive">
                {syncWarning}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="menu-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
          <header>
            <h1 className="text-lg font-semibold tracking-tight">Archetype plan</h1>
          </header>

          <div className="flex min-h-0 flex-col gap-6 xl:flex-row xl:items-start">
            <div className="min-w-0 flex-1 space-y-6 rounded-none border border-border bg-card px-4 py-5 sm:px-6">
              <OptimizerSettingsSection
                id="plan-stat-goals"
                title="Stat goals"
              >
                <PlanStatGoalsPicker
                  value={statGoals}
                  onChange={setStatGoals}
                  statIconByName={lookupPayload.statIconByName}
                />
                <AssumedStatModsPanel
                  value={assumedMods}
                  onChange={setAssumedMods}
                  showHeader={false}
                  className="mt-4 border-t border-border pt-4"
                />
              </OptimizerSettingsSection>

              <OptimizerSettingsSection
                id="plan-loadout-mix"
                title="Loadout mix"
              >
                <ArchetypeLoadoutPlanner
                  rows={archetypeRows}
                  selections={selections}
                  onSelectionsChange={setSelections}
                  statIconByName={lookupPayload.statIconByName}
                />
              </OptimizerSettingsSection>
            </div>

            <section
              aria-labelledby="plan-loadout-maxes"
              className="w-full shrink-0 rounded-none border border-border bg-card px-4 py-5 sm:px-6 xl:w-[22rem]"
            >
              <h2
                id="plan-loadout-maxes"
                className="text-sm font-semibold tracking-wide"
              >
                Loadout maximums
              </h2>
              <div className="mt-4">
                {loadoutBounds ? (
                  <TheoreticalStatMaxes
                    bounds={loadoutBounds}
                    statIconByName={lookupPayload.statIconByName}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Assign exactly {LOADOUT_PIECE_COUNT} pieces across archetypes
                    to see maximums.
                  </p>
                )}
              </div>
            </section>
          </div>

          <section
            aria-labelledby="plan-fragments-heading"
            className="w-fit max-w-full rounded-none border border-border bg-card px-3 py-3 sm:px-4"
          >
            <h2
              id="plan-fragments-heading"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Fragments
            </h2>
            <div className="mt-2">
              <PlanFragmentSelector
                lookup={optimizerLookup}
                selectedFragmentHashes={selectedFragmentHashes}
                onToggleFragment={toggleFragment}
                maxFragments={MAX_PLAN_FRAGMENTS}
                statIconByName={lookupPayload.statIconByName}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
