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
import { chromeToolbarShellClass } from "@/components/ui/chrome-square-icon-button";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";

const TABLE_FILTER_MENU_CONTENT =
  "max-h-[min(60vh,20rem)] overflow-y-auto rounded-none border border-white/15 bg-[#2d2e32] py-2 text-white shadow-xl";

const INVENTORY_TABLE_FILTER_TRIGGER =
  "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-none border border-white/15 bg-[#2d2e32] px-3 py-2 text-left text-sm text-white shadow-sm focus:outline-none focus:ring-1 focus:ring-white/25 disabled:cursor-not-allowed disabled:opacity-50";

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

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#1a1b1b]">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 pb-8 pt-[4.75rem] sm:px-6">
          {!hasInventory ? (
            <p className="text-sm text-white/60">
              No armor inventory loaded yet. Use Refresh in the header after
              signing in with Bungie.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="grid min-w-0 gap-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-white/50">
                    Class
                  </Label>
                  <div className={cn(chromeToolbarShellClass, "w-full sm:w-fit")}>
                    {CLASS_TABS.map((tab, i) => (
                      <button
                        key={tab.value}
                        type="button"
                        className={cn(
                          "flex h-10 shrink-0 items-center px-3 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/35",
                          i > 0 && "border-l border-white/15",
                          inventoryClass === tab.value &&
                            "bg-white/[0.08] text-white",
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
                  className={cn(
                    "grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-3 sm:gap-y-3 lg:grid-cols-4 lg:items-end lg:gap-x-4",
                  )}
                >
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="inv-filter-set" className="text-white/50">
                    Armor set
                  </Label>
                  <ArmorSetMultiCombobox
                    id="inv-filter-set"
                    options={sortedSets}
                    values={setHashes}
                    onValuesChange={setSetHashes}
                    aria-label="Armor set filter"
                    placeholder="All armor sets"
                    sharpCorners
                    triggerClassName={INVENTORY_TABLE_FILTER_TRIGGER}
                    summaryEmptyClassName="text-white/45"
                    caretClassName="opacity-60"
                    emptyCatalogMessage={
                      selectors.manifestEmpty
                        ? "Sync the manifest first."
                        : "No sets for this class."
                    }
                  />
                </div>

                <div className="grid min-w-0 gap-2">
                  <Label className="text-white/50">Archetype</Label>
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
                            archetypeHashes.length === 0 && "text-white/45",
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
                        <div className="px-3 py-2.5 text-sm text-white/50">
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
                              className="rounded-none pl-3 pr-9 text-white focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 [&>span]:left-auto [&>span]:right-2 [&>span]:top-1/2 [&>span]:-translate-y-1/2 [&>span]:text-white"
                            >
                              {a.name}
                            </DropdownMenuCheckboxItem>
                          );
                        })
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid min-w-0 gap-2">
                  <Label className="text-white/50">Tuning stat</Label>
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
                            tuningHashes.length === 0 && "text-white/45",
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
                        <div className="px-3 py-2.5 text-sm text-white/50">
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
                              className="rounded-none pl-3 pr-9 text-white focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 [&>span]:left-auto [&>span]:right-2 [&>span]:top-1/2 [&>span]:-translate-y-1/2 [&>span]:text-white"
                            >
                              {t.name}
                            </DropdownMenuCheckboxItem>
                          );
                        })
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid min-w-0 gap-2">
                  <Label className="text-white/50">Tertiary stat</Label>
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
                            tertiaryStats.length === 0 && "text-white/45",
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
                          className="rounded-none pl-3 pr-9 text-white focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 [&>span]:left-auto [&>span]:right-2 [&>span]:top-1/2 [&>span]:-translate-y-1/2 [&>span]:text-white"
                        >
                          {stat}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                </div>
              </div>

              <p className="text-xs text-white/45">
                Showing {filteredRows.length} piece
                {filteredRows.length === 1 ? "" : "s"} for{" "}
                {CLASS_NAMES[inventoryClass] ?? "class"}.
              </p>

              <div className="rounded-none border border-white/10 bg-[#141515]/80">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="w-px pe-2 text-white/60" aria-label="Icon" />
                      <TableHead className="text-white/60">Armor set</TableHead>
                      <TableHead className="text-white/60">Archetype</TableHead>
                      <TableHead className="text-white/60">Tuning</TableHead>
                      <TableHead className="text-white/60">Tertiary</TableHead>
                      <TableHead className="text-white/60">Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow className="border-white/10 hover:bg-white/[0.02]">
                        <TableCell
                          colSpan={6}
                          className="py-8 text-center text-sm text-white/50"
                        >
                          No armor matches these filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((piece) => (
                        <TableRow
                          key={piece.itemInstanceId}
                          className="border-white/10 hover:bg-white/[0.04]"
                        >
                          <TableCell className="w-px whitespace-nowrap py-2 pe-2 align-middle">
                            {piece.iconPath ? (
                              <span className="inline-flex rounded-none border border-white/10 bg-black/30 leading-none">
                                {/* eslint-disable-next-line @next/next/no-img-element -- Bungie CDN thumbnails; avoid bloating the bundle with next/image remotePatterns. */}
                                <img
                                  src={bungieIconUrl(piece.iconPath)}
                                  alt={`${SLOT_LABELS[piece.slot]} — ${piece.setName ?? "armor"}`}
                                  className="block max-h-10 max-w-12 h-auto w-auto"
                                  loading="lazy"
                                />
                              </span>
                            ) : (
                              <div
                                role="img"
                                aria-label={`${SLOT_LABELS[piece.slot]} — no artwork`}
                                className="inline-block size-10 rounded-none border border-white/10 bg-white/5"
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-white/90">
                            {piece.setName ?? "—"}
                          </TableCell>
                          <TableCell className="text-white/90">
                            {piece.archetypeName ?? "—"}
                          </TableCell>
                          <TableCell className="text-white/90">
                            {piece.tuningName ?? "—"}
                          </TableCell>
                          <TableCell className="text-white/80">
                            {piece.tertiaryStat ?? "—"}
                          </TableCell>
                          <TableCell className="text-white/70">
                            {formatLocation(piece)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
