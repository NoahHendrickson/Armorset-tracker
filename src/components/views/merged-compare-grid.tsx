"use client";

import type React from "react";
import {
  CLASS_NAMES,
  SLOT_ORDER,
  bungieIconUrl,
  type ArmorSlot,
} from "@/lib/bungie/constants";
import { ArmorSlotTrackerRowHeader } from "@/components/views/armor-slot-tracker-row-header";
import { TRACKER_SLOT_COLUMN_WIDTH } from "@/lib/workspace/workspace-constants";
import type { ArmorStatName, DerivedArmorPieceJson } from "@/lib/db/types";
import {
  isMergedExoticSlotCandidate,
  isUnionGridComplete,
  mergeCompareCellStateSpatial,
  MERGE_ACCENT_BLUE,
  MERGE_ACCENT_GREEN,
  unionTertiaryStats,
  type MergeCompareSpatialCellState,
} from "@/lib/views/merge-compare";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function TrackerHalfTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="whitespace-pre-line">{label}</TooltipContent>
    </Tooltip>
  );
}

const EXOTIC_SLOT_HINT_TITLE =
  "You can slot an exotic here and retain both 2pc bonuses";

function matchSummary(match: DerivedArmorPieceJson): string {
  const locationLabel =
    match.location.kind === "vault"
      ? "Vault"
      : `${CLASS_NAMES[match.location.classType] ?? "Unknown"}${
          match.location.equipped ? " (equipped)" : ""
        }`;
  const tuningLabel =
    match.tuningHash === null
      ? "tuning: unknown"
      : `tuning: ${match.tuningName ?? "unknown"}${
          match.tuningCommitted === false ? " (uncommitted)" : ""
        }`;
  return `${locationLabel} · ${tuningLabel}`;
}

function halfTitle(
  hasInventory: boolean,
  applicable: boolean,
  owned: boolean,
  count: number,
  matches: DerivedArmorPieceJson[],
): string {
  if (!applicable) return "Tracker — stat not used for this archetype";
  if (!hasInventory) return "Loading inventory…";
  if (!owned) return "0 matching pieces";
  if (matches.length === 1)
    return `Owned — ${matchSummary(matches[0])}`;
  return `Owned (${matches.length})\n${matches.map((m) => `• ${matchSummary(m)}`).join("\n")}`;
}

function MergeHalfSquare({
  hasInventory,
  state,
  panel,
  accent,
  matches,
}: {
  hasInventory: boolean;
  state: MergeCompareSpatialCellState;
  panel: "anchor" | "partner";
  accent: string;
  matches: DerivedArmorPieceJson[];
}) {
  const applicable =
    panel === "anchor" ? state.anchorApplicable : state.partnerApplicable;
  const owned = panel === "anchor" ? state.anchorOwned : state.partnerOwned;
  const count = panel === "anchor" ? state.anchorCount : state.partnerCount;
  const isDuplicate = applicable && owned && count > 1;
  const loading = applicable && !hasInventory;
  const outerRounded =
    panel === "anchor" ? "rounded-l-[4px]" : "rounded-r-[4px]";

  if (!applicable) {
    return (
      <TrackerHalfTooltip label="Not applicable for this tracker">
        <div
          className={cn(
            "relative flex h-full w-1/2 items-center justify-center bg-white/[0.08]",
            outerRounded,
          )}
          style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }}
        >
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 shadow-[inset_0_-4px_6px_-2px_rgba(0,0,0,0.18)]",
              outerRounded,
            )}
          />
        </div>
      </TrackerHalfTooltip>
    );
  }

  if (loading) {
    return (
      <TrackerHalfTooltip label="Loading inventory…">
        <div
          className={cn(
            "flex h-full w-1/2 items-center justify-center border border-white/35",
            outerRounded,
          )}
        >
          <span
            className="block size-3 shrink-0 rounded-sm border border-white/40 animate-pulse"
            aria-hidden
          />
        </div>
      </TrackerHalfTooltip>
    );
  }

  if (!owned) {
    return (
      <TrackerHalfTooltip label="0 matching pieces">
        <div
          className={cn(
            "flex h-full w-1/2 items-center justify-center border border-white/40",
            outerRounded,
          )}
        />
      </TrackerHalfTooltip>
    );
  }

  return (
    <TrackerHalfTooltip
      label={halfTitle(hasInventory, applicable, owned, count, matches)}
    >
      <div
        className={cn(
          "relative flex h-full w-1/2 items-center justify-center",
          outerRounded,
        )}
        style={{
          boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.2), 0 0 10px -1px ${
            panel === "anchor"
              ? "rgba(0, 255, 133, 0.45)"
              : "rgba(56, 189, 248, 0.45)"
          }`,
          backgroundColor: accent,
        }}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-4px_6px_-2px_rgba(0,0,0,0.2)]",
            outerRounded,
          )}
        />
        {isDuplicate ? (
          <span
            aria-hidden
            className="pointer-events-none absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-sm bg-[#ff3b30] shadow-[0_0_4px_-1px_rgba(255,59,48,0.6)]"
          />
        ) : null}
      </div>
    </TrackerHalfTooltip>
  );
}

interface MergedCompareGridProps {
  anchorPayload: SerializableTrackerPayload;
  partnerPayload: SerializableTrackerPayload;
  hasInventory: boolean;
}

/**
 * Merged tracker grid: union tertiary columns; left / green accent = anchor,
 * right / blue = merge partner (aligned with merged header).
 */
export function MergedCompareGrid({
  anchorPayload,
  partnerPayload,
  hasInventory,
}: MergedCompareGridProps) {
  const tertiaries = unionTertiaryStats(anchorPayload, partnerPayload);

  const iconPaths = {
    ...anchorPayload.tertiaryStatIconPaths,
    ...partnerPayload.tertiaryStatIconPaths,
  } as Partial<Record<ArmorStatName, string>>;

  const anchorSlotIcons = anchorPayload.armorSlotIconPaths as Partial<
    Record<ArmorSlot, string>
  >;
  const partnerSlotIcons = partnerPayload.armorSlotIconPaths as Partial<
    Record<ArmorSlot, string>
  >;

  if (tertiaries.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-white/5 p-4 text-sm text-white/60">
        No tertiary stats to compare for these trackers yet.
      </div>
    );
  }

  const complete = isUnionGridComplete(anchorPayload, partnerPayload);

  return (
    <div className="min-h-0 overflow-hidden">
      {complete ? (
        <p className="mb-2 text-xs font-medium text-[#00FF85]/90">
          Combined inventory fills every applicable cell for this overlay.
        </p>
      ) : null}
      <div
        role="table"
        aria-label="Merged tertiary stat comparison"
        className="flex min-w-max flex-col gap-4 pb-1"
      >
        <div role="row" className="flex items-center">
          {/* Left armor rail — anchor tracker (green header) */}
          <div
            aria-hidden
            className="h-6 shrink-0 border-r border-white/[0.12] p-2"
            style={{ width: TRACKER_SLOT_COLUMN_WIDTH }}
          />
          {tertiaries.map((t) => {
            const iconPath = iconPaths[t];
            return (
              <div
                key={t}
                role="columnheader"
                className="flex h-6 w-[100px] shrink-0 items-center gap-1 p-2 text-base text-white/45"
              >
                {iconPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bungieIconUrl(iconPath)}
                    width={18}
                    height={18}
                    alt=""
                    className="h-[18px] w-[18px] shrink-0 object-contain opacity-80"
                    loading="lazy"
                  />
                ) : null}
                <span className="truncate">{t}</span>
              </div>
            );
          })}
          {/* Right armor rail — merge partner (blue header) */}
          <div
            aria-hidden
            className="h-6 shrink-0 border-l border-white/[0.12] p-2"
            style={{ width: TRACKER_SLOT_COLUMN_WIDTH }}
          />
        </div>

        <div role="rowgroup" className="flex items-start">
          <div
            className="flex shrink-0 flex-col border-r border-white/[0.12]"
            style={{ width: TRACKER_SLOT_COLUMN_WIDTH }}
          >
            {SLOT_ORDER.map((slot, i) => (
              <ArmorSlotTrackerRowHeader
                key={slot}
                slot={slot}
                iconPath={anchorSlotIcons[slot]}
                isLastRow={i >= SLOT_ORDER.length - 1}
                tooltipSide="right"
              />
            ))}
          </div>

          {tertiaries.map((t) => (
            <div key={t} className="flex w-[100px] shrink-0 flex-col">
              {SLOT_ORDER.map((slot, i) => {
                const st = mergeCompareCellStateSpatial(
                  anchorPayload,
                  partnerPayload,
                  slot,
                  t,
                );
                const anchorMatches =
                  anchorPayload.progress.cells[slot]?.[t] ?? [];
                const partnerMatches =
                  partnerPayload.progress.cells[slot]?.[t] ?? [];
                const exoticCandidate = isMergedExoticSlotCandidate(
                  anchorPayload,
                  partnerPayload,
                  t,
                  slot,
                  { hasInventory },
                );
                return (
                  <div
                    key={slot}
                    role="cell"
                    className={`flex h-12 items-center justify-center p-2 ${
                      i < SLOT_ORDER.length - 1 ? "border-b border-white/10" : ""
                    }`}
                  >
                    {/*
                     * Same layout as ViewGrid duplicate badge: marker sits just
                     * right of the ownership square, vertically centered.
                     */}
                    <div className="relative inline-flex shrink-0">
                      <div className="flex size-6 shrink-0 rounded-[5px] border border-white/15">
                        <MergeHalfSquare
                          hasInventory={hasInventory}
                          state={st}
                          panel="anchor"
                          accent={MERGE_ACCENT_GREEN}
                          matches={anchorMatches}
                        />
                        <MergeHalfSquare
                          hasInventory={hasInventory}
                          state={st}
                          panel="partner"
                          accent={MERGE_ACCENT_BLUE}
                          matches={partnerMatches}
                        />
                      </div>
                      {exoticCandidate ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              role="img"
                              aria-label={EXOTIC_SLOT_HINT_TITLE}
                              className="pointer-events-auto overflow-hidden box-content absolute left-full top-1/2 ml-1.5 size-[8px] -translate-y-1/2 cursor-default rounded-[2px] border border-solid border-white/12 bg-[linear-gradient(140deg,rgba(232,184,74,1)_0%,rgba(218,186,114,1)_100%)] text-[rgba(255,255,255,0)] shadow-[0_0_4px_-1px_rgba(232,184,74,0.6)]"
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            {EXOTIC_SLOT_HINT_TITLE}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div
            className="flex shrink-0 flex-col border-l border-white/[0.12]"
            style={{ width: TRACKER_SLOT_COLUMN_WIDTH }}
          >
            {SLOT_ORDER.map((slot, i) => (
              <ArmorSlotTrackerRowHeader
                key={slot}
                slot={slot}
                iconPath={partnerSlotIcons[slot]}
                isLastRow={i >= SLOT_ORDER.length - 1}
                tooltipSide="left"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
