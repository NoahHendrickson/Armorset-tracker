"use client";

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ARMOR_STAT_NAMES, type DerivedArmorPieceJson } from "@/lib/db/types";
import {
  CLASS_NAMES,
  SLOT_LABELS,
  SLOT_ORDER,
  bungieIconUrl,
  type ArmorSlot,
} from "@/lib/bungie/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArmorSetMultiSelectPanel } from "@/components/views/armor-set-combobox";
import type { TrackerFormSelectors } from "@/components/workspace/new-tracker-dialog";
import { MagnifyingGlass, SlidersHorizontal, X } from "@phosphor-icons/react/dist/ssr";
import { usePinnedArmorSets } from "@/lib/views/use-pinned-armor-sets";

const TABLE_FILTER_MENU_CONTENT =
  "max-h-[min(60vh,20rem)] min-w-56 overflow-y-auto rounded-none py-2 shadow-xl";

/** Shared by header + body tables so columns line up (`table-fixed`). */
const INVENTORY_TABLE_COLGROUP = (
  <colgroup>
    <col className="w-14" />
    <col />
    <col />
    <col />
    <col />
    <col />
  </colgroup>
);

function slotRank(slot: ArmorSlot): number {
  return SLOT_ORDER.indexOf(slot);
}

function formatLocation(piece: DerivedArmorPieceJson): string {
  const loc = piece.location;
  if (loc.kind === "vault") return "Vault";
  if (loc.equipped) return "Equipped";
  return "Inventory";
}

type InventoryClass = 0 | 1 | 2;

const CLASS_TABS: Array<{ value: InventoryClass; label: string }> = [
  { value: 0, label: "Titan" },
  { value: 1, label: "Hunter" },
  { value: 2, label: "Warlock" },
];

interface InventoryTableViewProps {
  className?: string;
  banners?: ReactNode;
  syncWarning: string | null;
  hasInventory: boolean;
  inventory: DerivedArmorPieceJson[];
  selectors: TrackerFormSelectors;
}

export function InventoryTableView({
  className = "",
  banners,
  syncWarning,
  hasInventory,
  inventory,
  selectors,
}: InventoryTableViewProps) {
  const [inventoryClass, setInventoryClass] = useState<InventoryClass>(0);
  const [setHashes, setSetHashes] = useState<string[]>([]);
  const [archetypeHashes, setArchetypeHashes] = useState<string[]>([]);
  const [tuningHashes, setTuningHashes] = useState<string[]>([]);
  const [tertiaryStats, setTertiaryStats] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [searchUiOpen, setSearchUiOpen] = useState(false);
  const searchExpanded = searchUiOpen || search.trim().length > 0;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { pinnedHashes, togglePin } = usePinnedArmorSets();

  const sortedSets = useMemo(
    () => selectors.setsByClass[inventoryClass],
    [selectors.setsByClass, inventoryClass],
  );

  const sortedArchetypes = useMemo(
    () => [...selectors.archetypes].sort((a, b) => a.name.localeCompare(b.name)),
    [selectors.archetypes],
  );
  const sortedTunings = useMemo(
    () => [...selectors.tunings].sort((a, b) => a.name.localeCompare(b.name)),
    [selectors.tunings],
  );

  const activeFilterDimCount = useMemo(() => {
    let n = 0;
    if (setHashes.length > 0) n += 1;
    if (archetypeHashes.length > 0) n += 1;
    if (tuningHashes.length > 0) n += 1;
    if (tertiaryStats.length > 0) n += 1;
    return n;
  }, [setHashes, archetypeHashes, tuningHashes, tertiaryStats]);

  const filteredRows = useMemo(() => {
    let rows = inventory.filter((p) => p.classType === inventoryClass);
    if (setHashes.length > 0) {
      const allowed = new Set(setHashes.map(Number));
      rows = rows.filter(
        (p) => p.setHash != null && allowed.has(p.setHash),
      );
    }
    if (archetypeHashes.length > 0) {
      const allowed = new Set(archetypeHashes.map(Number));
      rows = rows.filter(
        (p) => p.archetypeHash != null && allowed.has(p.archetypeHash),
      );
    }
    if (tuningHashes.length > 0) {
      const allowed = new Set(tuningHashes.map(Number));
      rows = rows.filter(
        (p) => p.tuningHash != null && allowed.has(p.tuningHash),
      );
    }
    if (tertiaryStats.length > 0) {
      const allowed = new Set(tertiaryStats);
      rows = rows.filter(
        (p) => p.tertiaryStat != null && allowed.has(p.tertiaryStat),
      );
    }
    const trimmedSearch = search.trim().toLowerCase();
    if (trimmedSearch) {
      rows = rows.filter((p) => {
        const haystack = [
          p.setName,
          p.archetypeName,
          p.tuningName,
          p.tertiaryStat,
          SLOT_LABELS[p.slot],
        ]
          .filter((v): v is string => Boolean(v))
          .join(" ")
          .toLowerCase();
        return haystack.includes(trimmedSearch);
      });
    }
    rows = [...rows].sort((a, b) => {
      const sd = slotRank(a.slot) - slotRank(b.slot);
      if (sd !== 0) return sd;
      const na = (a.setName ?? "").localeCompare(b.setName ?? "");
      if (na !== 0) return na;
      return a.itemHash - b.itemHash;
    });
    return rows;
  }, [
    inventory,
    inventoryClass,
    setHashes,
    archetypeHashes,
    tuningHashes,
    tertiaryStats,
    search,
  ]);

  const armorSetEmptyCopy = selectors.manifestEmpty
    ? "Sync the manifest first."
    : "No sets for this class.";

  const hasTopMessage = Boolean(banners) || Boolean(syncWarning);

  function openSearchField() {
    setSearchUiOpen(true);
    queueMicrotask(() =>
      searchInputRef.current?.focus({ preventScroll: true }),
    );
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      {hasTopMessage ? (
        <div className="shrink-0 pt-[76px]">
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
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 pt-[4.75rem] sm:px-6">
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
                      colSpan={6}
                      className="h-auto border-b-0 bg-table-header px-3 py-0 text-left align-middle font-medium text-muted-foreground shadow-[inset_0_-1px_0_0_var(--border)] [&:has([role=checkbox])]:pr-0"
                    >
                      <div className="grid min-h-[52px] min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2">
                        <div className="flex min-w-0 shrink-0 overflow-hidden rounded-none bg-card">
                          {CLASS_TABS.map((tab) => (
                            <button
                              key={tab.value}
                              type="button"
                              className={cn(
                                "flex h-9 shrink-0 items-center border border-transparent px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                                inventoryClass === tab.value &&
                                  "border-border bg-accent text-foreground",
                              )}
                              onClick={() => {
                                setInventoryClass(tab.value);
                                setSetHashes((prev) =>
                                  prev.filter((h) =>
                                    selectors.setsByClass[tab.value].some(
                                      (s) => String(s.hash) === h,
                                    ),
                                  ),
                                );
                              }}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex min-w-0 shrink-0 items-center gap-2 self-center sm:gap-3">
                          <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              aria-label="Armor filters"
                              className="relative h-9 shrink-0 gap-1.5 rounded-none px-3 text-xs"
                            >
                              <SlidersHorizontal
                                weight="duotone"
                                aria-hidden
                                className="size-4"
                              />
                              <span className="hidden sm:inline">Filters</span>
                              {activeFilterDimCount > 0 ?
                                <span
                                  className="flex h-4 min-w-4 items-center justify-center rounded-none bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
                                  aria-hidden
                                >
                                  {activeFilterDimCount}
                                </span>
                              : null}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="min-w-48 rounded-none py-1"
                          >
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger inset>
                                Armor sets
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent
                                className="w-[min(90vw,22rem)] min-w-[18rem] rounded-none border-border p-0 shadow-xl"
                                collisionPadding={16}
                              >
                                <ArmorSetMultiSelectPanel
                                  key={inventoryClass}
                                  options={sortedSets}
                                  values={setHashes}
                                  onValuesChange={setSetHashes}
                                  emptyCatalogMessage={armorSetEmptyCopy}
                                  sharpCorners
                                  pinnedHashes={pinnedHashes}
                                  onTogglePin={togglePin}
                                  autoFocusSearch
                                  className="max-h-[min(70vh,22rem)]"
                                />
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger inset>
                                Archetypes
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent
                                className={cn(
                                  TABLE_FILTER_MENU_CONTENT,
                                  "min-w-64",
                                )}
                                collisionPadding={16}
                              >
                                {sortedArchetypes.length === 0 ?
                                  <div className="px-3 py-2.5 text-sm text-muted-foreground/80">
                                    No archetypes — sync the manifest first.
                                  </div>
                                : sortedArchetypes.map((a) => {
                                    const id = String(a.hash);
                                    return (
                                      <DropdownMenuCheckboxItem
                                        key={a.hash}
                                        checked={archetypeHashes.includes(id)}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={(c) => {
                                          setArchetypeHashes((prev) =>
                                            c
                                              ? [...prev, id]
                                              : prev.filter((h) => h !== id),
                                          );
                                        }}
                                      >
                                        {a.name}
                                      </DropdownMenuCheckboxItem>
                                    );
                                  })
                                }
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger inset>
                                Tertiary stats
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent
                                className={cn(
                                  TABLE_FILTER_MENU_CONTENT,
                                  "min-w-48",
                                )}
                                collisionPadding={16}
                              >
                                {ARMOR_STAT_NAMES.map((stat) => (
                                  <DropdownMenuCheckboxItem
                                    key={stat}
                                    checked={tertiaryStats.includes(stat)}
                                    onSelect={(e) => e.preventDefault()}
                                    onCheckedChange={(c) => {
                                      setTertiaryStats((prev) =>
                                        c
                                          ? [...prev, stat]
                                          : prev.filter((s) => s !== stat),
                                      );
                                    }}
                                  >
                                    {stat}
                                  </DropdownMenuCheckboxItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger inset>
                                Tuning stats
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent
                                className={cn(
                                  TABLE_FILTER_MENU_CONTENT,
                                  "min-w-56",
                                )}
                                collisionPadding={16}
                              >
                                {sortedTunings.length === 0 ?
                                  <div className="px-3 py-2.5 text-sm text-muted-foreground/80">
                                    No tunings — sync the manifest first.
                                  </div>
                                : sortedTunings.map((t) => {
                                    const id = String(t.hash);
                                    return (
                                      <DropdownMenuCheckboxItem
                                        key={t.hash}
                                        checked={tuningHashes.includes(id)}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={(c) => {
                                          setTuningHashes((prev) =>
                                            c
                                              ? [...prev, id]
                                              : prev.filter((h) => h !== id),
                                          );
                                        }}
                                      >
                                        {t.name}
                                      </DropdownMenuCheckboxItem>
                                    );
                                  })
                                }
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          </DropdownMenuContent>
                        </DropdownMenu>
                          <p
                            className="min-w-0 text-xs leading-snug text-muted-foreground/80"
                            aria-live="polite"
                          >
                            Showing {filteredRows.length} piece
                            {filteredRows.length === 1 ? "" : "s"} for{" "}
                            {CLASS_NAMES[inventoryClass] ?? "class"}.
                          </p>
                        </div>

                        <div className="min-w-0 justify-self-end">
                          {searchExpanded ?
                            <div
                              role="search"
                              className="relative min-h-[52px] min-w-0 lg:max-w-xs"
                            >
                              <MagnifyingGlass
                                weight="regular"
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                aria-hidden
                              />
                              <input
                                ref={searchInputRef}
                                id="inv-filter-search"
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search armor"
                                aria-label="Search armor"
                                onBlur={() => {
                                  if (!search.trim()) setSearchUiOpen(false);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key !== "Escape") return;
                                  if (search.trim()) {
                                    setSearch("");
                                  } else {
                                    setSearchUiOpen(false);
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="h-[52px] w-full min-w-0 border-0 border-b border-white bg-transparent py-0 ps-9 pe-9 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground/80 focus-visible:border-b focus-visible:border-white focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:hidden"
                              />
                              {search ?
                                <button
                                  type="button"
                                  aria-label="Clear search"
                                  onPointerDown={(e) => e.preventDefault()}
                                  onClick={() => setSearch("")}
                                  className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                  <X
                                    weight="bold"
                                    className="h-3.5 w-3.5"
                                    aria-hidden
                                  />
                                </button>
                              : null}
                            </div>
                          : <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Search armor"
                              aria-expanded={searchExpanded}
                              className="size-9 shrink-0 self-center rounded-none border-0 shadow-none hover:bg-accent/50"
                              onClick={openSearchField}
                            >
                              <MagnifyingGlass
                                weight="regular"
                                aria-hidden
                                className="size-4"
                              />
                            </Button>
                          }
                        </div>
                      </div>
                    </TableHead>
                  </TableRow>
                  <TableRow className="border-b-0 border-border hover:bg-transparent [&:hover]:bg-transparent">
                    <TableHead
                      className="w-px border-b border-border bg-table-header pe-2 text-table-header-foreground"
                      aria-label="Icon"
                    />
                    <TableHead className="border-b border-border bg-table-header text-table-header-foreground">
                      Armor set
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
                  </TableRow>
                </TableHeader>
                  </Table>
                </div>
                <div className="menu-scrollbar max-h-[calc(100dvh-13rem)] min-h-0 min-w-0 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]">
                  <Table
                    className="w-full table-fixed border-separate border-spacing-0"
                    containerClassName="overflow-visible"
                  >
                    {INVENTORY_TABLE_COLGROUP}
                <TableBody>
                  {filteredRows.length === 0 ?
                    <TableRow className="border-border hover:bg-transparent">
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-sm text-muted-foreground/80"
                      >
                        No armor matches these filters.
                      </TableCell>
                    </TableRow>
                  : filteredRows.map((piece) => (
                      <TableRow
                        key={piece.itemInstanceId}
                        className="border-border hover:bg-accent/60"
                      >
                        <TableCell className="w-px whitespace-nowrap py-1 pe-2 align-middle">
                          {piece.iconPath ?
                            <span className="inline-flex rounded-none border border-border bg-accent leading-none">
                              {/* eslint-disable-next-line @next/next/no-img-element -- Bungie CDN thumbnails; avoid bloating the bundle with next/image remotePatterns. */}
                              <img
                                src={bungieIconUrl(piece.iconPath)}
                                alt={`${SLOT_LABELS[piece.slot]} — ${piece.setName ?? "armor"}`}
                                className="block h-auto max-h-7 max-w-9 w-auto"
                                loading="lazy"
                              />
                            </span>
                          : <div
                              role="img"
                              aria-label={`${SLOT_LABELS[piece.slot]} — no artwork`}
                              className="inline-block size-7 rounded-none border border-border bg-accent/60"
                            />
                          }
                        </TableCell>
                        <TableCell className="py-1.5 text-foreground/90">
                          {piece.setName ?? "—"}
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
                      </TableRow>
                    ))
                  }
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
