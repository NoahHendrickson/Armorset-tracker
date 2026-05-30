"use client";

import { useDeferredValue, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { SLOT_LABELS, bungieIconUrl } from "@/lib/bungie/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { filterInventoryPieces, inventoryPieceDisplayName } from "@/lib/filters/filter-inventory";
import type { TrackerFormSelectors } from "@/lib/views/tracker-form-selectors";
import { usePinnedArmorSets } from "@/lib/views/use-pinned-armor-sets";
import { TrackerFilterBar } from "@/components/workspace/tracker-filter-bar";
import type { SavedViewsBarProps } from "@/components/workspace/saved-views-menu";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";
import { InventoryItemActions } from "@/components/dashboard/inventory-item-actions";

/** Shared by header + body tables so columns line up (`table-fixed`). */
const INVENTORY_TABLE_COLGROUP = (
  <colgroup>
    <col className="w-14" />
    <col />
    <col />
    <col />
    <col />
    <col />
    <col className="w-[15rem]" />
  </colgroup>
);

/** Approximate single-row height; the virtualizer remeasures real rows on mount. */
const ESTIMATED_ROW_HEIGHT_PX = 41;

function formatLocation(piece: DerivedArmorPieceJson): string {
  const loc = piece.location;
  if (loc.kind === "vault") return "Vault";
  if (loc.equipped) return "Equipped";
  return "Inventory";
}

interface InventoryTableViewProps {
  className?: string;
  banners?: ReactNode;
  syncWarning: string | null;
  hasInventory: boolean;
  inventory: DerivedArmorPieceJson[];
  selectors: TrackerFormSelectors;
  filters: GridFiltersJson;
  onFiltersChange: (next: GridFiltersJson) => void;
  savedViews?: SavedViewsBarProps;
}

export function InventoryTableView({
  className = "",
  banners,
  syncWarning,
  hasInventory,
  inventory,
  selectors,
  filters,
  onFiltersChange,
  savedViews,
}: InventoryTableViewProps) {
  const { pinnedHashes, togglePin } = usePinnedArmorSets();

  // Keep typing responsive: defer the search term so the filter + sort pass
  // runs on a lower-priority render instead of blocking every keystroke.
  const deferredSearch = useDeferredValue(filters.search);
  const filtersForFiltering = useMemo(
    () =>
      deferredSearch === filters.search
        ? filters
        : { ...filters, search: deferredSearch },
    [filters, deferredSearch],
  );
  const filteredRows = useMemo(
    () => filterInventoryPieces(inventory, filtersForFiltering),
    [inventory, filtersForFiltering],
  );

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT_PX,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - virtualRows[virtualRows.length - 1].end
      : 0;

  const hasTopMessage = Boolean(banners) || Boolean(syncWarning);

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
          {!hasInventory ? (
            <p className="text-sm text-muted-foreground">
              No armor inventory loaded yet. Use Refresh in the header after
              signing in with Bungie.
            </p>
          ) : (
            <div className="flex max-h-full min-h-0 min-w-0 w-full flex-col self-start overflow-hidden rounded-none border border-border bg-card">
              <div className="flex min-h-0 min-w-0 flex-col overflow-x-auto overflow-y-hidden">
                <div className="min-w-0 shrink-0">
                  <Table
                    className="w-full table-fixed border-separate border-spacing-0"
                    containerClassName="overflow-visible"
                  >
                    {INVENTORY_TABLE_COLGROUP}
                    <TableHeader className="[&_tr]:border-b-0">
                      <TableRow className="border-b-0 border-border hover:bg-transparent [&:hover]:bg-transparent">
                        <TableHead
                          colSpan={7}
                          className="h-auto w-full max-w-0 border-b-0 bg-table-header px-3 py-0 text-left align-middle font-medium text-muted-foreground shadow-[inset_0_-1px_0_0_var(--border)] [&:has([role=checkbox])]:pr-0"
                        >
                          <TrackerFilterBar
                            selectors={selectors}
                            value={filters}
                            onChange={onFiltersChange}
                            pinnedHashes={pinnedHashes}
                            onTogglePin={togglePin}
                            resultCount={filteredRows.length}
                            resultNoun={{
                              singular: "piece",
                              plural: "pieces",
                            }}
                            showRarityFilter
                            savedViews={savedViews}
                          />
                        </TableHead>
                      </TableRow>
                      <TableRow className="border-b-0 border-border hover:bg-transparent [&:hover]:bg-transparent">
                        <TableHead
                          className="w-px border-b border-border bg-table-header pe-2 text-table-header-foreground"
                          aria-label="Icon"
                        />
                        <TableHead className="border-b border-border bg-table-header text-table-header-foreground">
                          Name
                        </TableHead>
                        <TableHead className="border-b border-border bg-table-header text-table-header-foreground">
                          Archetype
                        </TableHead>
                        <TableHead className="border-b border-border bg-table-header text-table-header-foreground">
                          Tertiary
                        </TableHead>
                        <TableHead className="border-b border-border bg-table-header text-table-header-foreground">
                          Tuning
                        </TableHead>
                        <TableHead className="border-b border-border bg-table-header text-table-header-foreground">
                          Location
                        </TableHead>
                        <TableHead className="border-b border-border bg-table-header text-table-header-foreground">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                  </Table>
                </div>
                <div
                  ref={scrollerRef}
                  className="menu-scrollbar max-h-[calc(100dvh-13rem)] min-h-0 min-w-0 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"
                >
                  <Table
                    className="w-full table-fixed border-separate border-spacing-0"
                    containerClassName="overflow-visible"
                  >
                    {INVENTORY_TABLE_COLGROUP}
                    <TableBody>
                      {filteredRows.length === 0 ? (
                        <TableRow className="border-b-0 border-border hover:bg-transparent shadow-[inset_0_-1px_0_0_var(--border)]">
                          <TableCell
                            colSpan={7}
                            className="py-8 text-center text-sm text-muted-foreground/80"
                          >
                            No armor matches these filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {paddingTop > 0 ? (
                            <tr aria-hidden>
                              <td colSpan={7} style={{ height: paddingTop }} />
                            </tr>
                          ) : null}
                          {virtualRows.map((vRow) => {
                            const piece = filteredRows[vRow.index];
                            return (
                              <TableRow
                                key={piece.itemInstanceId}
                                data-index={vRow.index}
                                ref={rowVirtualizer.measureElement}
                                className="border-b-0 shadow-[inset_0_-1px_0_0_var(--border)] hover:bg-accent/60"
                              >
                                <TableCell className="w-px whitespace-nowrap py-1 pe-2 align-middle">
                                  {piece.iconPath ? (
                                    <span className="inline-flex rounded-none border border-border bg-accent leading-none">
                                      {/* eslint-disable-next-line @next/next/no-img-element -- Bungie CDN thumbnails; avoid bloating the bundle with next/image remotePatterns. */}
                                      <img
                                        src={bungieIconUrl(piece.iconPath)}
                                        alt={`${SLOT_LABELS[piece.slot]} — ${inventoryPieceDisplayName(piece) ?? "armor"}`}
                                        className="block h-auto max-h-7 max-w-9 w-auto"
                                        loading="lazy"
                                      />
                                    </span>
                                  ) : (
                                    <div
                                      role="img"
                                      aria-label={`${SLOT_LABELS[piece.slot]} — no artwork`}
                                      className="inline-block size-7 rounded-none border border-border bg-accent/60"
                                    />
                                  )}
                                </TableCell>
                                <TableCell className="py-1.5 text-foreground/90">
                                  {inventoryPieceDisplayName(piece) ?? "—"}
                                </TableCell>
                                <TableCell className="py-1.5 text-foreground/90">
                                  {piece.archetypeName ?? "—"}
                                </TableCell>
                                <TableCell className="py-1.5 text-foreground/80">
                                  {piece.tertiaryStat ?? "—"}
                                </TableCell>
                                <TableCell className="py-1.5 text-foreground/90">
                                  {piece.tuningName ?? "—"}
                                </TableCell>
                                <TableCell className="py-1.5 text-muted-foreground">
                                  {formatLocation(piece)}
                                </TableCell>
                                <TableCell className="py-1.5 pe-2 align-middle">
                                  <InventoryItemActions
                                    piece={piece}
                                    targetClass={filters.class}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {paddingBottom > 0 ? (
                            <tr aria-hidden>
                              <td colSpan={7} style={{ height: paddingBottom }} />
                            </tr>
                          ) : null}
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
