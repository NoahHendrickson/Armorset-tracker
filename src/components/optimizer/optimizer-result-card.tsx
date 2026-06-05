"use client";

import type { ReactNode } from "react";
import { ArmorStatIcon } from "@/components/ui/armor-stat-icon";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { SLOT_ORDER, bungieIconUrl } from "@/lib/bungie/constants";
import { inventoryPieceDisplayName } from "@/lib/filters/filter-inventory";
import { displayedStatTotal } from "@/lib/optimizer/constraints";
import type { OptimizerSolution } from "@/lib/optimizer/types";
import { tuningPositiveArmorStat } from "@/lib/views/tuning-positive-stat";
import { cn } from "@/lib/utils";

/**
 * Three aligned grid cells (archetype · tertiary · tuning) for one piece row.
 * Returned as a fragment so the parent `<li>` grid controls column widths.
 */
function PieceMetaCells({
  piece,
  statIconByName,
}: {
  piece: DerivedArmorPieceJson;
  statIconByName: Partial<Record<ArmorStatName, string>>;
}): ReactNode {
  const tuningPositive = piece.tuningName
    ? tuningPositiveArmorStat(piece.tuningName)
    : null;
  const tuningTitle =
    piece.tuningHash === null
      ? "Tuning unknown"
      : `${piece.tuningName ?? "Tuning unknown"}${
          piece.tuningCommitted === false ? " (uncommitted)" : ""
        }`;

  return (
    <>
      <span
        className="truncate text-xs text-muted-foreground"
        title={`Archetype: ${piece.archetypeName ?? "unknown"}`}
      >
        {piece.archetypeName ?? "—"}
      </span>
      <span
        className="inline-flex min-w-0 items-center gap-1 text-xs"
        title={`Tertiary: ${piece.tertiaryStat ?? "unknown"}`}
      >
        {piece.tertiaryStat ? (
          <>
            <ArmorStatIcon
              stat={piece.tertiaryStat}
              iconPath={statIconByName[piece.tertiaryStat]}
              size="sm"
            />
            <span className="truncate text-foreground">
              {piece.tertiaryStat}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
      <span
        className="inline-flex min-w-0 items-center gap-1 text-xs"
        title={tuningTitle}
      >
        {tuningPositive ? (
          <>
            <ArmorStatIcon
              stat={tuningPositive}
              iconPath={statIconByName[tuningPositive]}
              size="sm"
            />
            <span className="truncate text-foreground">+{tuningPositive}</span>
          </>
        ) : (
          <span className="truncate text-muted-foreground">
            {piece.tuningName ?? "—"}
          </span>
        )}
      </span>
    </>
  );
}

function pieceLocationLabel(piece: DerivedArmorPieceJson): string {
  if (piece.location.kind === "vault") return "Vault";
  return piece.location.equipped ? "Equipped" : "Character";
}

export interface OptimizerResultCardProps {
  solution: OptimizerSolution;
  piecesById: Map<string, DerivedArmorPieceJson>;
  statIconByName: Partial<Record<ArmorStatName, string>>;
  className?: string;
}

export function OptimizerResultCard({
  solution,
  piecesById,
  statIconByName,
  className,
}: OptimizerResultCardProps) {
  const displayTotals = ARMOR_STAT_NAMES.map(
    (stat) => displayedStatTotal(solution.totals[stat] ?? 0),
  );
  const total = displayTotals.reduce((sum, value) => sum + value, 0);

  return (
    <article
      className={cn(
        "rounded-none border border-border bg-card/80 p-3 transition-colors hover:bg-muted/20",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border pb-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {ARMOR_STAT_NAMES.map((stat, index) => (
            <div
              key={stat}
              className="inline-flex items-center gap-1 rounded-none border border-border bg-background px-2 py-1"
              title={
                (solution.totals[stat] ?? 0) < 0
                  ? `${stat}: ${solution.totals[stat]} (shown as ${displayTotals[index]})`
                  : stat
              }
            >
              <ArmorStatIcon
                stat={stat}
                iconPath={statIconByName[stat]}
                size="sm"
              />
              <span className="tabular-nums text-sm font-semibold text-foreground">
                {displayTotals[index]}
              </span>
            </div>
          ))}
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular-nums text-lg font-semibold leading-none text-foreground">
            {total}
          </p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </p>
        </div>
      </div>

      <ul className="mt-3 grid grid-cols-[2rem_minmax(0,1fr)_auto_auto_auto_auto] gap-x-3 gap-y-1">
        {SLOT_ORDER.map((slot) => {
          const piece = piecesById.get(solution.slots[slot]);
          const swaps = (solution.interchangeable?.[slot]?.length ?? 1) - 1;
          const name = piece
            ? (inventoryPieceDisplayName(piece) ?? "Unknown piece")
            : "Unknown piece";
          return (
            <li
              key={slot}
              className="col-span-full grid grid-cols-subgrid items-center"
            >
              {piece?.iconPath ? (
                <img
                  src={bungieIconUrl(piece.iconPath)}
                  alt={name}
                  className="size-8 rounded-none border border-border object-cover"
                />
              ) : (
                <span className="size-8 rounded-none border border-border bg-muted" />
              )}
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm text-foreground">{name}</span>
                {piece?.isExotic ? (
                  <span className="shrink-0 rounded-none border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500">
                    Exotic
                  </span>
                ) : null}
                {swaps > 0 ? (
                  <span
                    className="shrink-0 text-xs tabular-nums text-muted-foreground"
                    title={`${swaps} interchangeable cop${swaps === 1 ? "y" : "ies"}`}
                  >
                    +{swaps}
                  </span>
                ) : null}
              </div>
              {piece ? (
                <PieceMetaCells piece={piece} statIconByName={statIconByName} />
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">—</span>
                  <span className="text-xs text-muted-foreground">—</span>
                  <span className="text-xs text-muted-foreground">—</span>
                </>
              )}
              <span className="truncate text-right text-xs uppercase tracking-wide text-muted-foreground">
                {piece ? pieceLocationLabel(piece) : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
