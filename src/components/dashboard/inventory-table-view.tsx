"use client";

import { useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
import {
  ArmorSetMultiCombobox,
} from "@/components/views/armor-set-combobox";
import type { TrackerFormSelectors } from "@/components/workspace/new-tracker-dialog";
import { CaretDown, MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import { usePinnedArmorSets } from "@/lib/views/use-pinned-armor-sets";

const TABLE_FILTER_MENU_CONTENT =
  "max-h-[min(60vh,20rem)] overflow-y-auto rounded-none py-2 shadow-xl";

const INVENTORY_TABLE_FILTER_TRIGGER =
  "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-none border border-input bg-card px-3 py-2 text-left text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function multiOptionSummary(
  selected: string[],
  labelForValue: (v: string) => string | undefined,
  emptyPlaceholder: string,
): string {
  if (selected.length === 0) return emptyPlaceholder;
  const names = selected
    .map((v) => labelForValue(v))
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) return emptyPlaceholder;
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]}, ${names[1]}`;
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

type InventoryClass = 0 | 1 | 2;

const CLASS_TABS: Array<{ value: InventoryClass; label: string }> = [
  { value: 0, label: "Titan" },
  { value: 1, label: "Hunter" },
  { value: 2, label: "Warlock" },
];

function slotRank(slot: ArmorSlot): number {
  return SLOT_ORDER.indexOf(slot);
}

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

  const archetypeSummary = multiOptionSummary(
    archetypeHashes,
    (h) => sortedArchetypes.find((a) => String(a.hash) === h)?.name,
    "All archetypes",
  );
  const tuningSummary = multiOptionSummary(
    tuningHashes,
    (h) => sortedTunings.find((t) => String(t.hash) === h)?.name,
    "All tuning stats",
  );
  const tertiarySummary = multiOptionSummary(
    tertiaryStats,
    (s) => s,
    "All tertiary stats",
  );

  const hasTopMessage = Boolean(banners) || Boolean(syncWarning);

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
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-8 pt-[4.75rem] sm:px-6">
          {!hasInventory ? (
            <p className="text-sm text-muted-foreground">
              No armor inventory loaded yet. Use Refresh in the header after
              signing in with Bungie.
            </p>
          ) : (
            <>
              <div className="shrink-0 flex flex-col gap-3 sm:gap-4">
                <div className="grid min-w-0 gap-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Class
                  </Label>
                  <div className="flex h-10 w-full shrink-0 overflow-hidden rounded-none bg-card sm:w-fit">
                    {CLASS_TABS.map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        className={cn(
                          "flex h-10 shrink-0 items-center border border-transparent px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
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
                </div>

                <div
                  role="search"
                  aria-label="Inventory filter bar"
                  className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-stretch"
                >
                  <div className="relative flex min-w-0 items-center lg:w-72 lg:shrink-0">
                    <MagnifyingGlass
                      weight="regular"
                      className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground"
                      aria-hidden
                    />
                    <input
                      id="inv-filter-search"
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search armor"
                      aria-label="Search armor"
                      className="h-9 w-full min-w-0 rounded-none border border-input bg-card pl-9 pr-9 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/80 focus:outline-none focus:ring-1 focus:ring-ring [&::-webkit-search-cancel-button]:hidden"
                    />
                    {search ? (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                        className="absolute right-2 inline-flex h-5 w-5 items-center justify-center rounded-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <X weight="bold" className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : null}
                  </div>

                  <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:flex-1">
                    <ArmorSetMultiCombobox
                      id="inv-filter-set"
                      options={sortedSets}
                      values={setHashes}
                      onValuesChange={setSetHashes}
                      aria-label="Armor set filter"
                      placeholder="All armor sets"
                      sharpCorners
                      triggerClassName={INVENTORY_TABLE_FILTER_TRIGGER}
                      summaryEmptyClassName="text-muted-foreground/80"
                      caretClassName="opacity-60"
                      emptyCatalogMessage={
                        selectors.manifestEmpty
                          ? "Sync the manifest first."
                          : "No sets for this class."
                      }
                      pinnedHashes={pinnedHashes}
                      onTogglePin={togglePin}
                    />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          id="inv-filter-archetype"
                          aria-label="Archetype filter"
                          className={INVENTORY_TABLE_FILTER_TRIGGER}
                        >
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate",
                              archetypeHashes.length === 0 &&
                                "text-muted-foreground/80",
                            )}
                          >
                            {archetypeSummary}
                          </span>
                          <CaretDown
                            weight="duotone"
                            className="h-4 w-4 shrink-0 opacity-60"
                            aria-hidden
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className={cn(
                          TABLE_FILTER_MENU_CONTENT,
                          "min-w-[var(--radix-dropdown-menu-trigger-width)]",
                        )}
                      >
                        {sortedArchetypes.length === 0 ? (
                          <div className="px-3 py-2.5 text-sm text-muted-foreground/80">
                            No archetypes — sync the manifest first.
                          </div>
                        ) : (
                          sortedArchetypes.map((a) => {
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
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          id="inv-filter-tertiary"
                          aria-label="Tertiary stat filter"
                          className={INVENTORY_TABLE_FILTER_TRIGGER}
                        >
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate",
                              tertiaryStats.length === 0 &&
                                "text-muted-foreground/80",
                            )}
                          >
                            {tertiarySummary}
                          </span>
                          <CaretDown
                            weight="duotone"
                            className="h-4 w-4 shrink-0 opacity-60"
                            aria-hidden
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className={cn(
                          TABLE_FILTER_MENU_CONTENT,
                          "min-w-[var(--radix-dropdown-menu-trigger-width)]",
                        )}
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
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          id="inv-filter-tuning"
                          aria-label="Tuning stat filter"
                          className={INVENTORY_TABLE_FILTER_TRIGGER}
                        >
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate",
                              tuningHashes.length === 0 &&
                                "text-muted-foreground/80",
                            )}
                          >
                            {tuningSummary}
                          </span>
                          <CaretDown
                            weight="duotone"
                            className="h-4 w-4 shrink-0 opacity-60"
                            aria-hidden
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className={cn(
                          TABLE_FILTER_MENU_CONTENT,
                          "min-w-[var(--radix-dropdown-menu-trigger-width)]",
                        )}
                      >
                        {sortedTunings.length === 0 ? (
                          <div className="px-3 py-2.5 text-sm text-muted-foreground/80">
                            No tunings — sync the manifest first.
                          </div>
                        ) : (
                          sortedTunings.map((t) => {
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
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              <p className="shrink-0 text-xs text-muted-foreground/80">
                Showing {filteredRows.length} piece
                {filteredRows.length === 1 ? "" : "s"} for{" "}
                {CLASS_NAMES[inventoryClass] ?? "class"}.
              </p>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border border-border bg-card">
                <div className="min-h-0 flex-1 overflow-auto">
                  <Table containerClassName="overflow-visible">
                    <TableHeader className="[&_tr]:border-b-0">
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead
                          className="sticky top-0 z-10 w-px border-b border-border bg-card pe-2 text-muted-foreground"
                          aria-label="Icon"
                        />
                        <TableHead className="sticky top-0 z-10 border-b border-border bg-card text-muted-foreground">
                          Armor set
                        </TableHead>
                        <TableHead className="sticky top-0 z-10 border-b border-border bg-card text-muted-foreground">
                          Archetype
                        </TableHead>
                        <TableHead className="sticky top-0 z-10 border-b border-border bg-card text-muted-foreground">
                          Tertiary
                        </TableHead>
                        <TableHead className="sticky top-0 z-10 border-b border-border bg-card text-muted-foreground">
                          Tuning
                        </TableHead>
                        <TableHead className="sticky top-0 z-10 border-b border-border bg-card text-muted-foreground">
                          Location
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow className="border-border hover:bg-transparent">
                        <TableCell
                          colSpan={6}
                          className="py-8 text-center text-sm text-muted-foreground/80"
                        >
                          No armor matches these filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((piece) => (
                        <TableRow
                          key={piece.itemInstanceId}
                          className="border-border hover:bg-accent/60"
                        >
                          <TableCell className="w-px whitespace-nowrap py-1 pe-2 align-middle">
                            {piece.iconPath ? (
                              <span className="inline-flex rounded-none border border-border bg-accent leading-none">
                                {/* eslint-disable-next-line @next/next/no-img-element -- Bungie CDN thumbnails; avoid bloating the bundle with next/image remotePatterns. */}
                                <img
                                  src={bungieIconUrl(piece.iconPath)}
                                  alt={`${SLOT_LABELS[piece.slot]} — ${piece.setName ?? "armor"}`}
                                  className="block max-h-7 max-w-9 h-auto w-auto"
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
                    )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
