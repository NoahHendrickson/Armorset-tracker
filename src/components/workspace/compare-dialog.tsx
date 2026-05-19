"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MergedCompareGrid } from "@/components/views/merged-compare-grid";
import { TrackerIdentBadges } from "@/components/workspace/tracker-ident-badges";
import { TuningHeaderGlyph } from "@/components/views/tuning-header-glyph";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import { tuningPositiveArmorStat } from "@/lib/views/tuning-positive-stat";
import {
  buildEphemeralTrackerPayload,
  ephemeralTrackerId,
} from "@/lib/workspace/build-tracker-payload-core";

function tuningStatIconPathFromLookup(
  tuningName: string,
  lookup: GridLookupPayload,
): string | null {
  const positive = tuningPositiveArmorStat(tuningName);
  return positive !== null
    ? (lookup.statIconByName[positive] ?? null)
    : null;
}

const compareTrackerRowShellClass =
  "flex items-center gap-3 border border-border bg-card px-3 py-2";

export interface CompareTrackerDescriptor {
  setHash: number;
  archetypeHash: number;
  tuningHash: number;
  classType: number;
  setName: string;
  archetypeName: string;
  tuningName: string;
}

interface CompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: CompareTrackerDescriptor | null;
  /** Tiles available as partner choices — same class as the anchor by construction. */
  candidatePool: CompareTrackerDescriptor[];
  lookupPayload: GridLookupPayload;
  inventory: DerivedArmorPieceJson[];
  hasInventory: boolean;
}

/**
 * Modal compare flow. Anchor tile is pre-selected; user picks a partner from a
 * filterable list of same-class tiles; we render the existing
 * `MergedCompareGrid` for the chosen pair.
 */
export function CompareDialog({
  open,
  onOpenChange,
  anchor,
  candidatePool,
  lookupPayload,
  inventory,
  hasInventory,
}: CompareDialogProps) {
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filteredCandidates = useMemo(() => {
    if (!anchor) return [] as CompareTrackerDescriptor[];
    const trimmed = query.trim().toLowerCase();
    const aId = ephemeralTrackerId(anchor);
    let rows = candidatePool.filter((c) => ephemeralTrackerId(c) !== aId);
    if (trimmed) {
      rows = rows.filter((c) =>
        `${c.setName} ${c.archetypeName} ${c.tuningName}`
          .toLowerCase()
          .includes(trimmed),
      );
    }
    return rows;
  }, [anchor, candidatePool, query]);

  const partner = useMemo(() => {
    if (partnerId === null) return null;
    return candidatePool.find((c) => ephemeralTrackerId(c) === partnerId) ?? null;
  }, [candidatePool, partnerId]);

  const anchorPayload = useMemo(() => {
    if (!anchor) return null;
    return buildEphemeralTrackerPayload(anchor, inventory, lookupPayload);
  }, [anchor, inventory, lookupPayload]);

  const partnerPayload = useMemo(() => {
    if (!partner) return null;
    return buildEphemeralTrackerPayload(partner, inventory, lookupPayload);
  }, [partner, inventory, lookupPayload]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-4">
        <DialogHeader>
          <DialogTitle>Compare trackers</DialogTitle>
          <DialogDescription>
            {anchor
              ? `Pick a second tracker to compare against ${anchor.setName} · ${anchor.archetypeName}.`
              : "Pick a tracker to compare."}
          </DialogDescription>
        </DialogHeader>

        {anchor ? (
          <div className={`${compareTrackerRowShellClass} shrink-0`}>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              A
            </span>
            <TrackerIdentBadges
              setName={anchor.setName}
              archetypeName={anchor.archetypeName}
              tuning={
                <TuningHeaderGlyph
                  tuningName={anchor.tuningName}
                  iconPath={anchorPayload?.tuningStatIconPath ?? null}
                />
              }
            />
          </div>
        ) : null}

        {partner ? (
          <div
            className={`${compareTrackerRowShellClass} justify-between`}
          >
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                B
              </span>
              <TrackerIdentBadges
                setName={partner.setName}
                archetypeName={partner.archetypeName}
                tuning={
                  <TuningHeaderGlyph
                    tuningName={partner.tuningName}
                    iconPath={partnerPayload?.tuningStatIconPath ?? null}
                  />
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPartnerId(null)}
            >
              Change
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <MagnifyingGlass
                weight="regular"
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search trackers"
                aria-label="Search compare candidates"
                className="h-9 w-full min-w-0 rounded-none border border-border bg-card py-0 ps-9 pe-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/80 focus-visible:border-foreground focus-visible:ring-0"
              />
            </div>
            <div className="max-h-72 min-h-0 overflow-y-auto">
              {filteredCandidates.length === 0 ? (
                <p
                  className={`${compareTrackerRowShellClass} text-sm text-muted-foreground`}
                >
                  No other trackers in view match.
                </p>
              ) : (
                <ul
                  role="listbox"
                  aria-label="Compare candidates"
                  className="flex flex-col gap-2"
                >
                  {filteredCandidates.map((c) => {
                    const id = ephemeralTrackerId(c);
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() => setPartnerId(id)}
                          className={`${compareTrackerRowShellClass} w-full text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:bg-accent`}
                        >
                          <TrackerIdentBadges
                            setName={c.setName}
                            archetypeName={c.archetypeName}
                            tuning={
                              <TuningHeaderGlyph
                                tuningName={c.tuningName}
                                iconPath={tuningStatIconPathFromLookup(
                                  c.tuningName,
                                  lookupPayload,
                                )}
                              />
                            }
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {anchorPayload && partnerPayload ? (
          <div className="overflow-y-auto border border-border bg-card p-4">
            <MergedCompareGrid
              anchorPayload={anchorPayload}
              partnerPayload={partnerPayload}
              hasInventory={hasInventory}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

