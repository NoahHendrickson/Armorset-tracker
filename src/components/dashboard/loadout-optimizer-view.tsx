"use client";

import {
  useMemo,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import { Info } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AssumedStatModsPanel } from "@/components/optimizer/assumed-stat-mods-panel";
import { ExoticArmorPicker } from "@/components/optimizer/exotic-armor-picker";
import { OptimizerResultCard } from "@/components/optimizer/optimizer-result-card";
import { OptimizerSettingsSection } from "@/components/optimizer/optimizer-settings-section";
import { SetBonusPicker } from "@/components/optimizer/set-bonus-picker";
import { StatRangeSlider } from "@/components/optimizer/stat-range-slider";
import { SubclassFragmentPanel } from "@/components/optimizer/subclass-fragment-panel";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import { SLOT_ORDER } from "@/lib/bungie/constants";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { ClassSwitcher } from "@/components/workspace/class-switcher";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useStatBoundsForSliders } from "@/lib/optimizer/use-stat-bounds-for-sliders";
import {
  defaultStatConstraints,
  hasStatTargets,
  statConstraintsEqual,
} from "@/lib/optimizer/constraints";
import {
  DEFAULT_EXOTIC_LOCK,
  type ExoticLock,
} from "@/lib/optimizer/exotic-lock";
import { computeFragmentStatOffset } from "@/lib/optimizer/fragment-offset";
import {
  DEFAULT_ASSUMED_STAT_MODS,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import { setBonusSelectionConflict, type SetBonusSelection } from "@/lib/optimizer/set-bonus";
import {
  formatSearchComboCount,
  useOptimizerComboEstimates,
} from "@/lib/optimizer/use-optimizer-combo-estimates";
import { useOptimizerPool } from "@/lib/optimizer/use-optimizer-pool";
import { useOptimizerSearchSession } from "@/lib/optimizer/use-optimizer-search-session";
import type { StatConstraintRow } from "@/lib/optimizer/types";
import type { OptimizerLookupPayload } from "@/lib/views/optimizer-lookup-payload";
import { EMPTY_OPTIMIZER_LOOKUP } from "@/lib/views/optimizer-lookup-payload";
import type { GridFilterClass, GridFiltersJson } from "@/lib/workspace/grid-filters-schema";
import { WorkspaceSyncGatePanel } from "@/components/dashboard/workspace-sync-gate-panel";
import { useWorkspaceSync } from "@/components/dashboard/workspace-sync-status";
import { inventoryTableEmptyState } from "@/lib/workspace/workspace-data-health.shared";

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
  /** When false, heavy pool/bounds/search work is paused (tab hidden). */
  sessionActive?: boolean;
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
  sessionActive = true,
}: LoadoutOptimizerViewProps) {
  const {
    health,
    phase,
    manifestError,
    inventoryError,
    reauthMessage,
    retrySync,
  } = useWorkspaceSync();

  const [classType, setClassType] = useState<GridFilterClass>(filters.class);
  const [constraints, setConstraints] = useState<StatConstraintRow[]>(
    defaultStatConstraints,
  );
  const searchConstraints = useDebouncedValue(constraints, 400);
  const debouncedBoundsConstraints = useDebouncedValue(constraints, 150);
  const boundsPending = useMemo(
    () => !statConstraintsEqual(constraints, debouncedBoundsConstraints),
    [constraints, debouncedBoundsConstraints],
  );
  const boundsConstraints = boundsPending
    ? constraints
    : debouncedBoundsConstraints;
  const targetsPending = useMemo(
    () => !statConstraintsEqual(constraints, searchConstraints),
    [constraints, searchConstraints],
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

  const fragmentStatOffset = useMemo(
    () =>
      computeFragmentStatOffset(
        selectedFragmentHashes,
        optimizerLookup,
        classType,
      ),
    [selectedFragmentHashes, optimizerLookup, classType],
  );

  const {
    inventoryWithExoticBudget,
    optimizerPool,
    classPieceCount,
    canRunOptimizer,
  } = useOptimizerPool({
    inventory,
    classType,
    exoticLock,
    setExoticLock,
    exoticStatBudget: optimizerLookup.exoticStatBudget,
    enabled: sessionActive,
  });

  const bounds = useStatBoundsForSliders({
    pool: optimizerPool,
    statOffset: fragmentStatOffset,
    assumedStatMods,
    exoticLock,
    constraints: boundsConstraints,
    setBonusSelections: selectedSetBonuses,
    previewOnly: boundsPending,
    enabled: sessionActive,
  });

  const {
    rawComboCount,
    searchComboCount,
    searchComboCapped,
    hasSearchFilters,
    searchTooLarge,
    exoticAnyFeasible,
  } = useOptimizerComboEstimates({
    optimizerPool,
    exoticLock,
    searchConstraints,
    selectedSetBonuses,
    fragmentStatOffset,
    assumedStatMods,
    enabled: sessionActive,
  });

  const setBonusConflict = setBonusSelectionConflict(selectedSetBonuses);
  const canGenerateBuilds =
    hasStatTargets(constraints) || selectedSetBonuses.length > 0;

  const {
    workerState,
    run,
    cancel,
    optimizerRequest,
    groupedResults,
  } = useOptimizerSearchSession({
    optimizerPool,
    searchConstraints,
    constraints,
    fragmentStatOffset,
    assumedStatMods,
    exoticLock,
    selectedSetBonuses,
    canRunOptimizer,
    setBonusConflict,
    searchTooLarge,
    canGenerateBuilds,
    targetsPending,
    sessionActive,
  });

  const lockedExoticLabel = useMemo(() => {
    if (exoticLock.mode !== "locked") return null;
    const piece = inventory.find(
      (p) => p.itemInstanceId === exoticLock.itemInstanceId,
    );
    return piece?.displayName ?? "Exotic armor";
  }, [exoticLock, inventory]);

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

  const updateConstraint = (stat: ArmorStatName, min: number) => {
    startTransition(() => {
      setConstraints((rows) =>
        rows.map((row) => (row.stat === stat ? { ...row, min } : row)),
      );
    });
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
      <div
        role="status"
        className="flex shrink-0 items-center gap-2 border-b border-blue-500/30 bg-blue-500/5 px-4 py-2 sm:px-6"
      >
        <Info weight="duotone" className="size-4 shrink-0 text-blue-500" aria-hidden />
        <p className="text-sm font-medium">beta, barely works</p>
      </div>
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
                    <section
                      aria-label="Class"
                      className="border-b border-border first:pt-0 last:border-b-0 py-5"
                    >
                      <ClassSwitcher
                        value={classType}
                        onChange={setClassType}
                      />
                      <p className="mt-2 min-h-5 text-xs text-muted-foreground">
                        {optimizerPool.length.toLocaleString()} Tier&nbsp;5
                        piece{optimizerPool.length === 1 ? "" : "s"}
                        {searchComboCount > 0 ? (
                          <>
                            {" "}
                            · {formatSearchComboCount(searchComboCount, searchComboCapped)}{" "}
                            loadout combination
                            {searchComboCount === 1 && !searchComboCapped
                              ? ""
                              : "s"}
                            {hasSearchFilters ? " match your filters" : ""}
                            {exoticLock.mode === "locked" && lockedExoticLabel
                              ? ` (locked ${lockedExoticLabel})`
                              : null}
                          </>
                        ) : hasSearchFilters ? (
                          <> · no loadouts match your filters</>
                        ) : null}
                        {hasSearchFilters && rawComboCount > searchComboCount ? (
                          <>
                            {" "}
                            ({rawComboCount.toLocaleString()} in pool before
                            filters)
                          </>
                        ) : null}
                      </p>
                    </section>

                    <div className="space-y-4 border-b border-border py-4">
                      <OptimizerSettingsSection
                        id="optimizer-stat-priorities-heading"
                        title="Stat targets"
                        compact
                        className="border-b-0"
                      >
                        <div className="space-y-3">
                          <ul className="space-y-2.5">
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
                          <AssumedStatModsPanel
                            value={assumedStatMods}
                            onChange={setAssumedStatMods}
                          />
                        </div>
                      </OptimizerSettingsSection>

                      <OptimizerSettingsSection
                        id="optimizer-set-bonus-heading"
                        title="Armor set"
                        compact
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

                    <OptimizerSettingsSection
                      id="optimizer-exotic-heading"
                      title="Exotic armor"
                    >
                      <ExoticArmorPicker
                        inventory={inventory}
                        classType={classType}
                        exoticLock={exoticLock}
                        onExoticLockChange={setExoticLock}
                      />
                    </OptimizerSettingsSection>

                    <OptimizerSettingsSection
                      id="optimizer-fragments-heading"
                      title="Fragments"
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
                          {groupedResults.size > 0 ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Showing {groupedResults.size} build
                              {groupedResults.size === 1 ? "" : "s"}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {canGenerateBuilds &&
                          canRunOptimizer &&
                          setBonusConflict == null &&
                          !workerState.running &&
                          !targetsPending ? (
                            <Button
                              type="button"
                              variant={
                                searchTooLarge ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => run(optimizerRequest)}
                            >
                              Generate builds
                            </Button>
                          ) : null}
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
                        {!canGenerateBuilds
                          ? "Set at least one stat minimum or armor set requirement to generate builds."
                          : workerState.running
                            ? `Generating builds… ${Math.round(workerState.progress)}%`
                          : workerState.hasCompletedRun
                            ? exoticAnyFeasible
                              ? "No all-legendary builds match. Select an exotic below (e.g. Speaker's Sight)."
                              : "No builds match your targets. Lower a stat minimum, adjust set bonuses, or change the exotic."
                          : targetsPending
                            ? "Updating targets…"
                          : searchTooLarge
                            ? "Large search space — click Generate builds above."
                            : "Starting search…"}
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {[...groupedResults.entries()].map(
                          ([signature, solutions]) => (
                            <li key={signature}>
                              <OptimizerResultCard
                                solution={solutions[0]!}
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
