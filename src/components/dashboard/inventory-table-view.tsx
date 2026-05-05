"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ARMOR_STAT_NAMES, type DerivedArmorPieceJson } from "@/lib/db/types";
import {
  CLASS_NAMES,
  SLOT_LABELS,
  SLOT_ORDER,
  type ArmorSlot,
} from "@/lib/bungie/constants";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArmorSetCombobox } from "@/components/views/armor-set-combobox";
import type { TrackerFormSelectors } from "@/components/workspace/new-tracker-dialog";
import { chromeToolbarShellClass } from "@/components/ui/chrome-square-icon-button";

const ALL_SENTINEL = "__all__";

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
  const [setHash, setSetHash] = useState("");
  const [archetypeHash, setArchetypeHash] = useState(ALL_SENTINEL);
  const [tuningHash, setTuningHash] = useState(ALL_SENTINEL);
  const [tertiaryStat, setTertiaryStat] = useState<string>(ALL_SENTINEL);

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
    if (setHash) {
      const h = Number(setHash);
      rows = rows.filter((p) => p.setHash === h);
    }
    if (archetypeHash !== ALL_SENTINEL) {
      const h = Number(archetypeHash);
      rows = rows.filter((p) => p.archetypeHash === h);
    }
    if (tuningHash !== ALL_SENTINEL) {
      const h = Number(tuningHash);
      rows = rows.filter((p) => p.tuningHash === h);
    }
    if (tertiaryStat !== ALL_SENTINEL) {
      rows = rows.filter((p) => p.tertiaryStat === tertiaryStat);
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
    setHash,
    archetypeHash,
    tuningHash,
    tertiaryStat,
  ]);

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
              <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-3">
                <div className="grid gap-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-white/50">
                    Class
                  </Label>
                  <div className={cn(chromeToolbarShellClass, "w-fit")}>
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
                          setSetHash((prev) =>
                            prev &&
                            selectors.setsByClass[tab.value].some(
                              (s) => String(s.hash) === prev,
                            )
                              ? prev
                              : "",
                          );
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid min-w-[min(100%,14rem)] flex-1 gap-2">
                  <Label htmlFor="inv-filter-set" className="text-white/50">
                    Armor set
                  </Label>
                  <ArmorSetCombobox
                    id="inv-filter-set"
                    options={sortedSets}
                    value={setHash}
                    onValueChange={setSetHash}
                    aria-label="Armor set filter"
                    placeholder="Any armor set"
                    sharpCorners
                    emptyCatalogMessage={
                      selectors.manifestEmpty
                        ? "Sync the manifest first."
                        : "No sets for this class."
                    }
                  />
                </div>

                <div className="grid min-w-[min(100%,12rem)] flex-1 gap-2">
                  <Label htmlFor="inv-filter-archetype" className="text-white/50">
                    Archetype
                  </Label>
                  <Select
                    value={archetypeHash}
                    onValueChange={setArchetypeHash}
                  >
                    <SelectTrigger
                      id="inv-filter-archetype"
                      aria-label="Archetype filter"
                      className="rounded-none border-white/15 bg-[#2d2e32] text-white"
                    >
                      <SelectValue placeholder="Any archetype" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-white/15 bg-[#2d2e32] text-white">
                      <SelectItem
                        value={ALL_SENTINEL}
                        className="rounded-none focus:bg-white/10 focus:text-white"
                      >
                        Any archetype
                      </SelectItem>
                      {sortedArchetypes.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-white/50">
                          No archetypes — sync the manifest first.
                        </div>
                      ) : (
                        sortedArchetypes.map((a) => (
                          <SelectItem
                            key={a.hash}
                            value={String(a.hash)}
                            className="rounded-none focus:bg-white/10 focus:text-white"
                          >
                            {a.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid min-w-[min(100%,12rem)] flex-1 gap-2">
                  <Label htmlFor="inv-filter-tuning" className="text-white/50">
                    Tuning stat
                  </Label>
                  <Select value={tuningHash} onValueChange={setTuningHash}>
                    <SelectTrigger
                      id="inv-filter-tuning"
                      aria-label="Tuning stat filter"
                      className="rounded-none border-white/15 bg-[#2d2e32] text-white"
                    >
                      <SelectValue placeholder="Any tuning" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-white/15 bg-[#2d2e32] text-white">
                      <SelectItem
                        value={ALL_SENTINEL}
                        className="rounded-none focus:bg-white/10 focus:text-white"
                      >
                        Any tuning
                      </SelectItem>
                      {sortedTunings.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-white/50">
                          No tunings — sync the manifest first.
                        </div>
                      ) : (
                        sortedTunings.map((t) => (
                          <SelectItem
                            key={t.hash}
                            value={String(t.hash)}
                            className="rounded-none focus:bg-white/10 focus:text-white"
                          >
                            {t.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid min-w-[min(100%,12rem)] flex-1 gap-2">
                  <Label htmlFor="inv-filter-tertiary" className="text-white/50">
                    Tertiary stat
                  </Label>
                  <Select value={tertiaryStat} onValueChange={setTertiaryStat}>
                    <SelectTrigger
                      id="inv-filter-tertiary"
                      aria-label="Tertiary stat filter"
                      className="rounded-none border-white/15 bg-[#2d2e32] text-white"
                    >
                      <SelectValue placeholder="Any tertiary" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-white/15 bg-[#2d2e32] text-white">
                      <SelectItem
                        value={ALL_SENTINEL}
                        className="rounded-none focus:bg-white/10 focus:text-white"
                      >
                        Any tertiary
                      </SelectItem>
                      {ARMOR_STAT_NAMES.map((stat) => (
                        <SelectItem
                          key={stat}
                          value={stat}
                          className="rounded-none focus:bg-white/10 focus:text-white"
                        >
                          {stat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      <TableHead className="text-white/60">Slot</TableHead>
                      <TableHead className="text-white/60">Armor set</TableHead>
                      <TableHead className="text-white/60">Archetype</TableHead>
                      <TableHead className="text-white/60">Tuning</TableHead>
                      <TableHead className="text-white/60">Primary</TableHead>
                      <TableHead className="text-white/60">Secondary</TableHead>
                      <TableHead className="text-white/60">Tertiary</TableHead>
                      <TableHead className="text-white/60">Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow className="border-white/10 hover:bg-white/[0.02]">
                        <TableCell
                          colSpan={8}
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
                          <TableCell className="font-medium text-white">
                            {SLOT_LABELS[piece.slot]}
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
                            {piece.primaryStat ?? "—"}
                          </TableCell>
                          <TableCell className="text-white/80">
                            {piece.secondaryStat ?? "—"}
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
