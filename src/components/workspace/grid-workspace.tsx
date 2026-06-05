"use client";

import {
  memo,
  useCallback,
  useDeferredValue,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { enumerateVisibleTrackers } from "@/lib/filters/enumerate-trackers";
import {
  indexInventoryByTriple,
  inventoryTripleKey,
} from "@/lib/views/progress";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import type { TrackerFormSelectors } from "@/lib/views/tracker-form-selectors";
import {
  buildEphemeralTrackerPayload,
  ephemeralTrackerId,
  type TrackerDescriptor,
} from "@/lib/workspace/build-tracker-payload-core";
import {
  gridFiltersHaveUnblockingSelection,
  type GridFiltersJson,
} from "@/lib/workspace/grid-filters-schema";
import { TrackerFilterBar } from "@/components/workspace/tracker-filter-bar";
import type { SavedViewsBarProps } from "@/components/workspace/saved-views-menu";
import { TrackerGridContent } from "@/components/workspace/tracker-grid-content";
import { CompareDialog } from "@/components/workspace/compare-dialog";
import { WorkspaceSyncGatePanel } from "@/components/dashboard/workspace-sync-gate-panel";
import { useWorkspaceSync } from "@/components/dashboard/workspace-sync-status";
import {
  inventoryTableEmptyState,
  isWorkspaceSyncGateState,
} from "@/lib/workspace/workspace-data-health.shared";
import {
  TRACKER_GRID_TILE_DISPLAY_HEIGHT_PX,
  TRACKER_GRID_TILE_DISPLAY_WIDTH_PX,
  TRACKER_GRID_TILE_HEIGHT,
  TRACKER_GRID_VISUAL_SCALE,
  TRACKER_WIDTH,
} from "@/lib/workspace/workspace-constants";
import { usePinnedArmorSets } from "@/lib/views/use-pinned-armor-sets";

/** Stable empty bucket so tiles with no matching pieces keep referential identity. */
const EMPTY_PIECES: DerivedArmorPieceJson[] = [];
const EMPTY_INVENTORY_INDEX = new Map<string, DerivedArmorPieceJson[]>();

const ROW_GAP_PX = 16;
/** Virtual row height for scaled tiles + vertical gap. */
const ROW_PITCH_PX = TRACKER_GRID_TILE_DISPLAY_HEIGHT_PX + ROW_GAP_PX;
function trackerGridColumnCountForWidth(scrollerClientWidth: number): number {
  const tile = TRACKER_GRID_TILE_DISPLAY_WIDTH_PX;
  const raw = Math.floor(
    (scrollerClientWidth + ROW_GAP_PX) / (tile + ROW_GAP_PX),
  );
  return Math.max(1, raw);
}

interface GridWorkspaceProps {
  banners: ReactNode;
  syncWarning: string | null;
  hasInventory: boolean;
  selectors: TrackerFormSelectors;
  inventory: DerivedArmorPieceJson[];
  lookupPayload: GridLookupPayload;
  filters: GridFiltersJson;
  onFiltersChange: (next: GridFiltersJson) => void;
  savedViews?: SavedViewsBarProps;
  /** When false (tab hidden), skip tracker cross-product and tile indexing. */
  enumerationActive?: boolean;
}

export function GridWorkspace({
  banners,
  syncWarning,
  hasInventory,
  selectors,
  inventory,
  lookupPayload,
  filters,
  onFiltersChange,
  savedViews,
  enumerationActive = true,
}: GridWorkspaceProps) {
  const { pinnedHashes, togglePin } = usePinnedArmorSets();
  const {
    health,
    phase,
    manifestError,
    inventoryError,
    reauthMessage,
    retrySync,
  } = useWorkspaceSync();

  const syncGateState = useMemo(() => {
    const state = inventoryTableEmptyState({
      health,
      phase,
      manifestError,
      inventoryError,
      reauthMessage,
      filteredCount: 0,
      classType: filters.class,
      filtersExcludeAll: false,
    });
    return isWorkspaceSyncGateState(state) ? state : null;
  }, [
    filters.class,
    health,
    inventoryError,
    manifestError,
    phase,
    reauthMessage,
  ]);

  // Class-bucketed inventory; cheap to re-compute when `inventory` changes.
  const inventoryByClass = useMemo(() => {
    const out: Record<number, DerivedArmorPieceJson[]> = { 0: [], 1: [], 2: [] };
    for (const p of inventory) {
      if (p.classType === 0 || p.classType === 1 || p.classType === 2) {
        out[p.classType].push(p);
      }
    }
    return out;
  }, [inventory]);

  const inventoryForClass = useMemo(
    () =>
      enumerationActive
        ? (inventoryByClass[filters.class] ?? EMPTY_PIECES)
        : EMPTY_PIECES,
    [enumerationActive, inventoryByClass, filters.class],
  );

  // Typing in the search box must stay responsive. Defer the search term so the
  // full cross-product enumeration runs on a lower-priority render instead of
  // blocking every keystroke; other filter dimensions still update eagerly.
  const deferredSearch = useDeferredValue(filters.search);
  const filtersForEnumeration = useMemo(
    () =>
      deferredSearch === filters.search
        ? filters
        : { ...filters, search: deferredSearch },
    [filters, deferredSearch],
  );
  const visibleTrackers = useMemo(
    () =>
      enumerationActive
        ? enumerateVisibleTrackers(filtersForEnumeration, selectors)
        : [],
    [enumerationActive, filtersForEnumeration, selectors],
  );

  // Bucket the class inventory once so each tile resolves its matching pieces
  // with a single lookup instead of re-scanning the whole inventory.
  const inventoryIndex = useMemo(
    () =>
      enumerationActive
        ? indexInventoryByTriple(inventoryForClass)
        : EMPTY_INVENTORY_INDEX,
    [enumerationActive, inventoryForClass],
  );
  const unblocked = gridFiltersHaveUnblockingSelection(filters);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrollerEl, setScrollerEl] = useState<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = useState(1);

  const scrollerRefCallback = useCallback((node: HTMLDivElement | null) => {
    scrollerRef.current = node;
    setScrollerEl(node);
  }, []);

  useLayoutEffect(() => {
    if (!scrollerEl) return;
    const tick = () => {
      const next = trackerGridColumnCountForWidth(scrollerEl.clientWidth);
      setColumnCount((prev) => (prev === next ? prev : next));
    };
    tick();
    const ro = new ResizeObserver(tick);
    ro.observe(scrollerEl);
    return () => ro.disconnect();
  }, [scrollerEl]);

  const rows = useMemo<TrackerDescriptor[][]>(() => {
    if (visibleTrackers.length === 0 || columnCount < 1) return [];
    const out: TrackerDescriptor[][] = [];
    for (let i = 0; i < visibleTrackers.length; i += columnCount) {
      out.push(visibleTrackers.slice(i, i + columnCount));
    }
    return out;
  }, [visibleTrackers, columnCount]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ROW_PITCH_PX,
    overscan: 2,
  });

  // ---- Compare dialog state ----
  const [compareAnchor, setCompareAnchor] =
    useState<TrackerDescriptor | null>(null);
  const compareOpen = compareAnchor !== null;

  // Stable identity so memoized tiles don't re-render when the parent updates
  // for unrelated reasons (scroll, compare open/close).
  const handleCompareClick = useCallback((descriptor: TrackerDescriptor) => {
    setCompareAnchor(descriptor);
  }, []);

  const hasTopMessage = Boolean(banners) || Boolean(syncWarning);
  const totalSize = virtualizer.getTotalSize();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
          {syncGateState ? (
            <WorkspaceSyncGatePanel
              state={syncGateState}
              onRetry={retrySync}
            />
          ) : (
            <>
          <div className="min-w-0 w-full shrink-0 overflow-hidden rounded-none border border-border bg-table-header px-3">
            <TrackerFilterBar
              selectors={selectors}
              value={filters}
              onChange={onFiltersChange}
              pinnedHashes={pinnedHashes}
              onTogglePin={togglePin}
              showTertiaryStatFilter={false}
              savedViews={savedViews}
            />
          </div>

          {!unblocked ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="max-w-md text-center text-sm text-muted-foreground">
                <p className="text-base font-medium text-foreground">
                  Pick a set, archetype, or tuning to see trackers.
                </p>
              </div>
            </div>
          ) : visibleTrackers.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                No trackers match these filters.
              </p>
            </div>
          ) : (
            <div
              ref={scrollerRefCallback}
              className="menu-scrollbar relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            >
              <div
                style={{ height: totalSize, width: "100%", position: "relative" }}
              >
                {virtualizer.getVirtualItems().map((vRow) => {
                  const rowItems = rows[vRow.index] ?? [];
                  return (
                    <div
                      key={vRow.key}
                      data-row-index={vRow.index}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${vRow.start}px)`,
                        height: ROW_PITCH_PX,
                        paddingBottom: ROW_GAP_PX,
                      }}
                    >
                      <div
                        className="grid h-full w-max max-w-none justify-start gap-4"
                        style={{
                          gridTemplateColumns: `repeat(${columnCount}, ${TRACKER_GRID_TILE_DISPLAY_WIDTH_PX}px)`,
                        }}
                      >
                        {rowItems.map((d) => (
                          <GridTile
                            key={ephemeralTrackerId(d)}
                            descriptor={d}
                            inventory={
                              inventoryIndex.get(
                                inventoryTripleKey(
                                  d.setHash,
                                  d.archetypeHash,
                                  d.tuningHash,
                                ),
                              ) ?? EMPTY_PIECES
                            }
                            lookupPayload={lookupPayload}
                            hasInventory={hasInventory}
                            onCompareClick={handleCompareClick}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
            </>
          )}
        </div>
      </div>

      <CompareDialog
        key={compareAnchor ? ephemeralTrackerId(compareAnchor) : "no-anchor"}
        open={compareOpen}
        onOpenChange={(o) => {
          if (!o) setCompareAnchor(null);
        }}
        anchor={compareAnchor}
        candidatePool={visibleTrackers}
        lookupPayload={lookupPayload}
        inventory={inventoryForClass}
        hasInventory={hasInventory}
      />
    </div>
  );
}

interface GridTileProps {
  descriptor: TrackerDescriptor;
  inventory: DerivedArmorPieceJson[];
  lookupPayload: GridLookupPayload;
  hasInventory: boolean;
  onCompareClick: (descriptor: TrackerDescriptor) => void;
}

/**
 * Memoized so a parent re-render (scroll, compare open/close) doesn't rebuild
 * every visible tile's payload and re-reconcile its ~25 tooltip cells. Props
 * are referentially stable per tile: the descriptor and pre-bucketed inventory
 * keep identity until enumeration or inventory actually changes.
 */
const GridTile = memo(function GridTile({
  descriptor,
  inventory,
  lookupPayload,
  hasInventory,
  onCompareClick,
}: GridTileProps) {
  const payload = useMemo(
    () => buildEphemeralTrackerPayload(descriptor, inventory, lookupPayload),
    [descriptor, inventory, lookupPayload],
  );
  return (
    <div
      className="shrink-0 overflow-hidden"
      style={{
        width: TRACKER_GRID_TILE_DISPLAY_WIDTH_PX,
        height: TRACKER_GRID_TILE_DISPLAY_HEIGHT_PX,
      }}
    >
      <div
        style={{
          width: TRACKER_WIDTH,
          height: TRACKER_GRID_TILE_HEIGHT,
          transform: `scale(${TRACKER_GRID_VISUAL_SCALE})`,
          transformOrigin: "top left",
        }}
      >
        <TrackerGridContent
          payload={payload}
          hasInventory={hasInventory}
          onCompareClick={() => onCompareClick(descriptor)}
        />
      </div>
    </div>
  );
});
