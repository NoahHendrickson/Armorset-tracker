"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import type { TrackerFormSelectors } from "@/components/workspace/new-tracker-dialog";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import {
  buildEphemeralTrackerPayload,
  ephemeralTrackerId,
} from "@/lib/workspace/build-tracker-payload-core";
import {
  gridFiltersHaveUnblockingSelection,
  type GridFiltersJson,
} from "@/lib/workspace/grid-filters-schema";
import { TrackerFilterBar } from "@/components/workspace/tracker-filter-bar";
import { TrackerGridContent } from "@/components/workspace/tracker-grid-content";
import {
  CompareDialog,
  type CompareTrackerDescriptor,
} from "@/components/workspace/compare-dialog";
import {
  TRACKER_GRID_TILE_DISPLAY_HEIGHT_PX,
  TRACKER_GRID_TILE_DISPLAY_WIDTH_PX,
  TRACKER_GRID_TILE_HEIGHT,
  TRACKER_GRID_VISUAL_SCALE,
  TRACKER_WIDTH,
} from "@/lib/workspace/workspace-constants";
import { usePinnedArmorSets } from "@/lib/views/use-pinned-armor-sets";

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
  savedViewsSlot?: ReactNode;
}

type TrackerDescriptor = CompareTrackerDescriptor;

export function GridWorkspace({
  banners,
  syncWarning,
  hasInventory,
  selectors,
  inventory,
  lookupPayload,
  filters,
  onFiltersChange,
  savedViewsSlot,
}: GridWorkspaceProps) {
  const { pinnedHashes, togglePin } = usePinnedArmorSets();

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

  const inventoryForClass = inventoryByClass[filters.class] ?? [];

  // ---- Visible trackers (enumerate filtered cross-product) ----
  const unblocked = gridFiltersHaveUnblockingSelection(filters);

  const visibleTrackers = useMemo<TrackerDescriptor[]>(() => {
    if (!unblocked) return [];

    const setOptions = selectors.setsByClass[filters.class];
    const setIds =
      filters.setHashes.length > 0
        ? new Set(filters.setHashes)
        : null;
    const archetypeIds =
      filters.archetypeHashes.length > 0
        ? new Set(filters.archetypeHashes)
        : null;
    const tuningIds =
      filters.tuningHashes.length > 0
        ? new Set(filters.tuningHashes)
        : null;
    const searchTerm = filters.search.trim().toLowerCase();

    const sets = setOptions.filter((s) => (setIds ? setIds.has(s.hash) : true));
    const archetypes = selectors.archetypes.filter((a) =>
      archetypeIds ? archetypeIds.has(a.hash) : true,
    );
    const tunings = selectors.tunings.filter((t) =>
      tuningIds ? tuningIds.has(t.hash) : true,
    );

    const out: TrackerDescriptor[] = [];
    for (const set of sets) {
      for (const arch of archetypes) {
        for (const tun of tunings) {
          if (searchTerm) {
            const haystack =
              `${set.name} ${arch.name} ${tun.name}`.toLowerCase();
            if (!haystack.includes(searchTerm)) continue;
          }
          out.push({
            setHash: set.hash,
            archetypeHash: arch.hash,
            tuningHash: tun.hash,
            classType: filters.class,
            setName: set.name,
            archetypeName: arch.name,
            tuningName: tun.name,
          });
        }
      }
    }

    out.sort((a, b) => {
      const s = a.setName.localeCompare(b.setName);
      if (s !== 0) return s;
      const ar = a.archetypeName.localeCompare(b.archetypeName);
      if (ar !== 0) return ar;
      const tu = a.tuningName.localeCompare(b.tuningName);
      if (tu !== 0) return tu;
      return a.setHash - b.setHash;
    });

    return out;
  }, [
    unblocked,
    filters.class,
    filters.setHashes,
    filters.archetypeHashes,
    filters.tuningHashes,
    filters.search,
    selectors.setsByClass,
    selectors.archetypes,
    selectors.tunings,
  ]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = useState(1);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const tick = () => {
      const next = trackerGridColumnCountForWidth(el.clientWidth);
      setColumnCount((prev) => (prev === next ? prev : next));
    };
    tick();
    const ro = new ResizeObserver(tick);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
          <div className="shrink-0 rounded-none border border-border bg-table-header px-3">
            <TrackerFilterBar
              selectors={selectors}
              value={filters}
              onChange={onFiltersChange}
              pinnedHashes={pinnedHashes}
              onTogglePin={togglePin}
              resultCount={visibleTrackers.length}
              resultNoun={{ singular: "tracker", plural: "trackers" }}
              showTertiaryStatFilter={false}
              savedViewsSlot={savedViewsSlot}
            />
          </div>

          {!unblocked ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="max-w-md text-center text-sm text-muted-foreground">
                <p className="text-base font-medium text-foreground">
                  Pick a set, archetype, or tuning to see trackers.
                </p>
                <p className="mt-2">
                  Use the Filters menu above to narrow down to the combinations
                  you care about.
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
              ref={scrollerRef}
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
                            inventory={inventoryForClass}
                            lookupPayload={lookupPayload}
                            hasInventory={hasInventory}
                            onCompareClick={() => setCompareAnchor(d)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
  onCompareClick: () => void;
}

function GridTile({
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
          onCompareClick={onCompareClick}
        />
      </div>
    </div>
  );
}
