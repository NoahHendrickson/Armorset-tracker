"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExoticArmorPicker } from "@/components/optimizer/exotic-armor-picker";
import { OptimizerResultCard } from "@/components/optimizer/optimizer-result-card";
import { OptimizerSettingsSection } from "@/components/optimizer/optimizer-settings-section";
import { SetBonusPicker } from "@/components/optimizer/set-bonus-picker";
import { StatRangeSlider } from "@/components/optimizer/stat-range-slider";
import { SubclassFragmentPanel } from "@/components/optimizer/subclass-fragment-panel";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import { CLASS_NAMES, SLOT_ORDER } from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { ClassGlyph } from "@/components/ui/class-glyph";
import { cn } from "@/lib/utils";
import { computeStatBounds } from "@/lib/optimizer/bounds";
import {
  defaultStatConstraints,
  hasStatTargets,
} from "@/lib/optimizer/constraints";
import {
  DEFAULT_EXOTIC_LOCK,
  normalizeExoticLock,
  uniqueOwnedExoticsForClass,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import { computeFragmentStatOffset, addStatOffsets } from "@/lib/optimizer/fragment-offset";
import {
  computeAssumedModStatOffset,
  DEFAULT_ASSUMED_STAT_MODS,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import {
  filterOptimizerPool,
  optimizerEligiblePieces,
  poolCoversAllSlots,
} from "@/lib/optimizer/pool";
import { setBonusSelectionConflict, type SetBonusSelection } from "@/lib/optimizer/set-bonus";
import { groupSolutionsBySignature } from "@/lib/optimizer/signature";
import type { StatConstraintRow } from "@/lib/optimizer/types";
import { useOptimizerAutoRun } from "@/lib/optimizer/use-optimizer-auto-run";
import { useOptimizerWorker } from "@/lib/optimizer/use-optimizer-worker";
import type { OptimizerLookupPayload } from "@/lib/views/optimizer-lookup-payload";
import { EMPTY_OPTIMIZER_LOOKUP } from "@/lib/views/optimizer-lookup-payload";
import type { GridFilterClass, GridFiltersJson } from "@/lib/workspace/grid-filters-schema";
import { WorkspaceSyncGatePanel } from "@/components/dashboard/workspace-sync-gate-panel";
import { useWorkspaceSync } from "@/components/dashboard/workspace-sync-status";
import { inventoryTableEmptyState } from "@/lib/workspace/workspace-data-health.shared";

const OPTIMIZER_CLASS_OPTIONS: Array<{ value: GridFilterClass; label: string }> =
  [
    { value: 0, label: CLASS_NAMES[0] ?? "Titan" },
    { value: 1, label: CLASS_NAMES[1] ?? "Hunter" },
    { value: 2, label: CLASS_NAMES[2] ?? "Warlock" },
  ];

/** Subclass fragment slots are aspect-gated; current sandbox tops out at 5. */
const MAX_FRAGMENTS = 5;

export interface LoadoutOptimizerViewProps {
  className?: string;
  banners?: ReactNode;
  syncWarning: string | null;
  hasInventory: boolean;
  inventory: DerivedArmorPieceJson[];
  /** Shared workspace filters — used only to seed the initial class selection. */
  filters: GridFiltersJson;
  onFiltersChange: (next: GridFiltersJson) => void;
  optimizerLookup?: OptimizerLookupPayload;
  /** Manifest stat icons (same slice as the Tracker grid). */
  statIconByName?: GridLookupPayload["statIconByName"];
}

export function LoadoutOptimizerView({
  className = "",
  banners,
  syncWarning,
  hasInventory,
  inventory,
  filters,
  optimizerLookup = EMPTY_OPTIMIZER_LOOKUP,
  statIconByName = {},
}: LoadoutOptimizerViewProps) {
  const {
    health,
    phase,
    manifestError,
    inventoryError,
    reauthMessage,
    retrySync,
  } = useWorkspaceSync();

  // Optimizer state is independent from the Table/Tracker tabs — changing class
  // here doesn't mutate the shared workspace filters.
  const [classType, setClassType] = useState<number>(filters.class);
  const [constraints, setConstraints] = useState<StatConstraintRow[]>(
    defaultStatConstraints,
  );
  const [exoticLock, setExoticLock] = useState<ExoticLock>(DEFAULT_EXOTIC_LOCK);
  const [subclassState, setSubclassState] = useState<{
    classType: number;
    subclassKey: string | null;
    fragmentHashes: number[];
  }>({
    classType,
    subclassKey: null,
    fragmentHashes: [],
  });
  const selectedSubclassKey = useMemo(
    () =>
      subclassState.classType === classType ? subclassState.subclassKey : null,
    [subclassState, classType],
  );
  const selectedFragmentHashes = useMemo(
    () =>
      subclassState.classType === classType ? subclassState.fragmentHashes : [],
    [subclassState, classType],
  );
  const [selectedSetBonuses, setSelectedSetBonuses] = useState<
    SetBonusSelection[]
  >([]);
  const [assumedStatMods, setAssumedStatMods] = useState<AssumedStatMods>(
    DEFAULT_ASSUMED_STAT_MODS,
  );
  const { state: workerState, run, cancel } = useOptimizerWorker();

  const fragmentStatOffset = useMemo(
    () =>
      computeFragmentStatOffset(
        selectedFragmentHashes,
        optimizerLookup,
        classType,
      ),
    [selectedFragmentHashes, optimizerLookup, classType],
  );
  const activeTargetStats = useMemo(
    () =>
      constraints
        .filter((row) => row.min > 0)
        .map((row) => row.stat),
    [constraints],
  );
  const modStatOffset = useMemo(
    () => computeAssumedModStatOffset(assumedStatMods, 5, activeTargetStats),
    [assumedStatMods, activeTargetStats],
  );
  const statOffset = useMemo(
    () => addStatOffsets(fragmentStatOffset, modStatOffset),
    [fragmentStatOffset, modStatOffset],
  );
  const eligiblePieces = useMemo(
    () => optimizerEligiblePieces(inventory, classType),
    [inventory, classType],
  );
  const optimizerPool = useMemo(
    () =>
      filterOptimizerPool(inventory, classType, {
        exoticLock,
        exoticStatBudget: optimizerLookup.exoticStatBudget,
      }),
    [inventory, classType, exoticLock, optimizerLookup.exoticStatBudget],
  );
  const ownedExotics = useMemo(
    () => uniqueOwnedExoticsForClass(inventory, classType),
    [inventory, classType],
  );

  useEffect(() => {
    setExoticLock((prev) => {
      const next = normalizeExoticLock(prev, inventory, classType);
      if (
        prev.mode === next.mode &&
        (prev.mode !== "locked" ||
          (next.mode === "locked" &&
            prev.itemInstanceId === next.itemInstanceId))
      ) {
        return prev;
      }
      return next;
    });
  }, [inventory, classType]);
  const classPieceCount = useMemo(
    () => inventory.filter((p) => p.classType === classType).length,
    [inventory, classType],
  );
  const bounds = useMemo(
    () => computeStatBounds(optimizerPool, statOffset, exoticLock),
    [optimizerPool, statOffset, exoticLock],
  );
  const boundsWithExotics = useMemo(
    () =>
      exoticLock.mode === "none" && ownedExotics.length > 0
        ? computeStatBounds(
            filterOptimizerPool(inventory, classType, {
              exoticLock: { mode: "any" },
              exoticStatBudget: optimizerLookup.exoticStatBudget,
            }),
            statOffset,
            { mode: "any" },
          )
        : null,
    [
      exoticLock.mode,
      ownedExotics.length,
      inventory,
      classType,
      statOffset,
      optimizerLookup.exoticStatBudget,
    ],
  );
  const exoticBoundsHint = useMemo(() => {
    if (boundsWithExotics == null) return null;
    return ARMOR_STAT_NAMES.some(
      (stat) => boundsWithExotics[stat].max > bounds[stat].max,
    );
  }, [bounds, boundsWithExotics]);
  const canRunOptimizer =
    optimizerPool.length > 0 && poolCoversAllSlots(optimizerPool);
  const missingSlotCoverage =
    optimizerPool.length > 0 && !poolCoversAllSlots(optimizerPool);
  const noTier5 = classPieceCount > 0 && eligiblePieces.length === 0;
  const setBonusConflict = setBonusSelectionConflict(selectedSetBonuses);

  const optimizerRequest = useMemo(
    () => ({
      pool: optimizerPool,
      constraints,
      statOffset,
      exoticLock,
      setBonusSelections: selectedSetBonuses,
      topN: 20,
    }),
    [optimizerPool, constraints, statOffset, exoticLock, selectedSetBonuses],
  );

  useOptimizerAutoRun(
    optimizerRequest,
    canRunOptimizer && setBonusConflict == null,
    run,
    cancel,
  );

  const groupedResults = useMemo(
    () => groupSolutionsBySignature(workerState.solutions),
    [workerState.solutions],
  );
  const piecesById = useMemo(() => {
    const map = new Map<string, DerivedArmorPieceJson>();
    for (const piece of inventory) {
      map.set(piece.itemInstanceId, piece);
    }
    return map;
  }, [inventory]);

  const emptyState = useMemo(
    () =>
      inventoryTableEmptyState({
        health,
        phase,
        manifestError,
        inventoryError,
        reauthMessage,
        filteredCount: classPieceCount,
        classType,
        filtersExcludeAll: false,
      }),
    [
      classType,
      classPieceCount,
      health,
      inventoryError,
      manifestError,
      phase,
      reauthMessage,
    ],
  );

  const hasTopMessage = Boolean(banners) || Boolean(syncWarning);
  const ready = hasInventory && emptyState === null;
  const activeStatTargets = hasStatTargets(constraints);

  const updateConstraint = (stat: ArmorStatName, min: number) => {
    setConstraints((rows) =>
      rows.map((row) => (row.stat === stat ? { ...row, min } : row)),
    );
  };

  const handleSubclassChange = (key: string | null) => {
    setSubclassState({ classType, subclassKey: key, fragmentHashes: [] });
  };

  const toggleFragment = (plugHash: number) => {
    setSubclassState((prev) => {
      const base =
        prev.classType === classType
          ? prev
          : {
              classType,
              subclassKey: null,
              fragmentHashes: [] as number[],
            };
      const hashes = base.fragmentHashes;
      const alreadySelected = hashes.includes(plugHash);
      if (!alreadySelected && hashes.length >= MAX_FRAGMENTS) {
        return base;
      }
      return {
        classType,
        subclassKey: base.subclassKey,
        fragmentHashes: alreadySelected
          ? hashes.filter((h) => h !== plugHash)
          : [...hashes, plugHash],
      };
    });
  };

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
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

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 pt-4 sm:px-6">
          {emptyState ? (
            <WorkspaceSyncGatePanel state={emptyState} onRetry={retrySync} />
          ) : ready ? (
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-none border border-border bg-card">
              <div className="menu-scrollbar grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
                  <div
                    className="min-h-0 overflow-x-hidden overflow-y-auto border-b border-border px-4 sm:px-6 lg:border-b-0 lg:border-r"
                    aria-label="Optimizer settings"
                  >
                    <OptimizerSettingsSection
                      id="optimizer-class-heading"
                      title="Class"
                      description="Optimizer uses vault and character armor for the selected class."
                    >
                      <div
                        className="flex flex-wrap items-center gap-2"
                        role="group"
                        aria-label="Class"
                      >
                        {OPTIMIZER_CLASS_OPTIONS.map((option) => {
                          const selected = classType === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={selected}
                              title={option.label}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-none border px-3 py-2 text-sm transition-colors",
                                selected
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border bg-background text-foreground hover:bg-muted",
                              )}
                              onClick={() => setClassType(option.value)}
                            >
                              <ClassGlyph
                                classType={option.value}
                                className="size-5 shrink-0"
                              />
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {optimizerPool.length} Tier&nbsp;5 piece
                        {optimizerPool.length === 1 ? "" : "s"} in pool
                      </p>
                    </OptimizerSettingsSection>

                    <div className="border-b border-border py-4">
                      <div className="grid grid-cols-1 items-start gap-x-5 gap-y-4 md:grid-cols-2">
                        <OptimizerSettingsSection
                          id="optimizer-stat-priorities-heading"
                          title="Stat targets"
                          compact
                          description="Minimums on the 0–200 track. Double-click the shaded band to snap to max."
                          className="border-b-0"
                        >
                          <fieldset className="space-y-1">
                            <legend className="text-[11px] font-medium text-foreground">
                              Assumed stat mods
                            </legend>
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              <label className="inline-flex items-center gap-1.5 text-xs">
                                <input
                                  type="checkbox"
                                  checked={assumedStatMods.major}
                                  onChange={(e) =>
                                    setAssumedStatMods((prev) => ({
                                      ...prev,
                                      major: e.target.checked,
                                    }))
                                  }
                                  className="size-3 shrink-0 rounded-none border-input"
                                />
                                Major (+50)
                              </label>
                              <label className="inline-flex items-center gap-1.5 text-xs">
                                <input
                                  type="checkbox"
                                  checked={assumedStatMods.minor}
                                  onChange={(e) =>
                                    setAssumedStatMods((prev) => ({
                                      ...prev,
                                      minor: e.target.checked,
                                    }))
                                  }
                                  className="size-3 shrink-0 rounded-none border-input"
                                />
                                Minor (+25)
                              </label>
                            </div>
                          </fieldset>
                          {noTier5 ? (
                            <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                              No Tier&nbsp;5 armor found for this class. Refresh
                              inventory or pick a class with Tier&nbsp;5 pieces.
                            </p>
                          ) : null}
                          {!noTier5 &&
                          classPieceCount > 0 &&
                          optimizerPool.length === 0 ? (
                            <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                              Tier&nbsp;5 pieces are missing stat data. Refresh
                              inventory from the header.
                            </p>
                          ) : null}
                          {missingSlotCoverage ? (
                            <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                              Your Tier&nbsp;5 pool doesn&apos;t cover every slot
                              — you need helmet, arms, chest, legs, and a class
                              item.
                            </p>
                          ) : null}
                          <ul className="mt-2 space-y-1">
                            {ARMOR_STAT_NAMES.map((stat) => {
                              const row = constraints.find((r) => r.stat === stat)!;
                              const range = bounds[stat];
                              return (
                                <li key={stat}>
                                  <StatRangeSlider
                                    stat={stat}
                                    iconPath={statIconByName[stat]}
                                    min={row.min}
                                    achievableMin={range.min}
                                    achievableMax={range.max}
                                    onChange={(min) => updateConstraint(stat, min)}
                                    compact
                                  />
                                </li>
                              );
                            })}
                          </ul>
                        </OptimizerSettingsSection>

                        <OptimizerSettingsSection
                          id="optimizer-set-bonus-heading"
                          title="Armor set"
                          compact
                          description="Require set bonuses from pieces in your pool."
                          className="border-b-0"
                        >
                          <SetBonusPicker
                            pool={optimizerPool}
                            setPerks={optimizerLookup.setPerks}
                            selected={selectedSetBonuses}
                            onChange={setSelectedSetBonuses}
                            compact
                          />
                        </OptimizerSettingsSection>
                      </div>
                    </div>

                    <OptimizerSettingsSection
                      id="optimizer-exotic-heading"
                      title="Exotic armor"
                      description="Pick all-legendary, any one exotic, or lock a specific piece. Each exotic name appears once per slot."
                    >
                      <ExoticArmorPicker
                        inventory={inventory}
                        classType={classType}
                        exoticLock={exoticLock}
                        onExoticLockChange={setExoticLock}
                      />
                      {exoticBoundsHint ? (
                        <p className="mt-2 text-sm text-amber-600 dark:text-amber-500">
                          Achievable stat ranges exclude exotics while &ldquo;No
                          exotic&rdquo; is selected. Use &ldquo;Any exotic&rdquo;
                          or lock a piece if your build uses one.
                        </p>
                      ) : null}
                    </OptimizerSettingsSection>

                    <OptimizerSettingsSection
                      id="optimizer-fragments-heading"
                      title="Fragments"
                      description="Subclass fragments adjust achievable ranges and build totals."
                      className="pb-6"
                    >
                      <SubclassFragmentPanel
                        classType={classType}
                        lookup={optimizerLookup}
                        selectedSubclassKey={selectedSubclassKey}
                        onSubclassChange={handleSubclassChange}
                        selectedFragmentHashes={selectedFragmentHashes}
                        onToggleFragment={toggleFragment}
                        maxFragments={MAX_FRAGMENTS}
                      />
                    </OptimizerSettingsSection>
                  </div>

                  <section
                    className="flex min-h-0 flex-col overflow-hidden p-4 sm:p-6"
                    aria-labelledby="optimizer-results-heading"
                  >
                    <div className="shrink-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2
                            id="optimizer-results-heading"
                            className="text-sm font-semibold tracking-wide text-foreground"
                          >
                            Results
                          </h2>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Totals include armor rolls, fragments, and assumed
                            stat mods.
                          </p>
                          {groupedResults.size > 0 ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Showing {groupedResults.size} build
                              {groupedResults.size === 1 ? "" : "s"}
                            </p>
                          ) : null}
                        </div>
                        {workerState.running ? (
                          <span className="inline-flex items-center gap-2 text-xs text-foreground">
                            <span
                              className="size-3 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-foreground"
                              aria-hidden
                            />
                            Generating… {Math.round(workerState.progress)}%
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={cancel}
                            >
                              Cancel
                            </Button>
                          </span>
                        ) : null}
                      </div>
                      {workerState.error ? (
                        <p role="alert" className="mt-2 text-sm text-destructive">
                          {workerState.error}
                        </p>
                      ) : null}
                    </div>

                    <div className="menu-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto">
                    {workerState.running && groupedResults.size === 0 ? (
                      <ul className="mt-4 space-y-3" aria-hidden>
                        {[0, 1, 2].map((i) => (
                          <li
                            key={i}
                            className="space-y-2 rounded border border-border p-3"
                          >
                            <Skeleton className="h-4 w-3/4" />
                            {SLOT_ORDER.map((slot) => (
                              <div key={slot} className="flex items-center gap-2">
                                <Skeleton className="size-7 rounded" />
                                <Skeleton className="h-3 flex-1" />
                              </div>
                            ))}
                          </li>
                        ))}
                      </ul>
                    ) : groupedResults.size === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {!activeStatTargets
                          ? "Set at least one stat minimum to generate builds."
                          : workerState.hasCompletedRun
                            ? "No builds match your targets. Lower a stat minimum, adjust set bonuses, or change the exotic."
                            : "Generating builds…"}
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {[...groupedResults.entries()].map(
                          ([signature, solutions]) => (
                            <li key={signature}>
                              <OptimizerResultCard
                                solution={solutions[0]!}
                                variantCount={solutions.length}
                                piecesById={piecesById}
                                statIconByName={statIconByName}
                              />
                            </li>
                          ),
                        )}
                      </ul>
                    )}
                    </div>
                  </section>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
