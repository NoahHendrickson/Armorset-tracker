"use client";

import { ArmorStatIcon } from "@/components/ui/armor-stat-icon";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import { SLOT_LABELS, SLOT_ORDER, bungieIconUrl } from "@/lib/bungie/constants";
import { inventoryPieceDisplayName } from "@/lib/filters/filter-inventory";
import type { OptimizerSolution } from "@/lib/optimizer/types";
import { cn } from "@/lib/utils";

function pieceLocationLabel(piece: DerivedArmorPieceJson): string {
  if (piece.location.kind === "vault") return "Vault";
  return piece.location.equipped ? "Equipped" : "Character";
}

export interface OptimizerResultCardProps {
  solution: OptimizerSolution;
  variantCount: number;
  piecesById: Map<string, DerivedArmorPieceJson>;
  statIconByName: Partial<Record<ArmorStatName, string>>;
  className?: string;
}

export function OptimizerResultCard({
  solution,
  variantCount,
  piecesById,
  statIconByName,
  className,
}: OptimizerResultCardProps) {
  const total = ARMOR_STAT_NAMES.reduce(
    (sum, stat) => sum + (solution.totals[stat] ?? 0),
    0,
  );

  return (
    <article
      className={cn(
        "rounded-none border border-border bg-card/80 p-3 transition-colors hover:bg-muted/20",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border pb-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {ARMOR_STAT_NAMES.map((stat) => (
            <div
              key={stat}
              className="inline-flex items-center gap-1 rounded-none border border-border bg-background px-2 py-1"
              title={stat}
            >
              <ArmorStatIcon
                stat={stat}
                iconPath={statIconByName[stat]}
                size="sm"
              />
              <span className="tabular-nums text-sm font-semibold text-foreground">
                {solution.totals[stat] ?? 0}
              </span>
            </div>
          ))}
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular-nums text-lg font-semibold leading-none text-foreground">
            {total}
          </p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </p>
        </div>
      </div>

      {variantCount > 1 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {variantCount} builds hit these stats — one shown.
        </p>
      ) : null}

      <ul className="mt-3 space-y-1">
        {SLOT_ORDER.map((slot) => {
          const piece = piecesById.get(solution.slots[slot]);
          const swaps = (solution.interchangeable?.[slot]?.length ?? 1) - 1;
          return (
            <li
              key={slot}
              className="flex items-center gap-2 text-sm"
            >
              {piece?.iconPath ? (
                <img
                  src={bungieIconUrl(piece.iconPath)}
                  alt=""
                  className="size-8 shrink-0 rounded-none border border-border object-cover"
                />
              ) : (
                <span className="size-8 shrink-0 rounded-none border border-border bg-muted" />
              )}
              <span className="w-12 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {SLOT_LABELS[slot]}
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground">
                {piece
                  ? (inventoryPieceDisplayName(piece) ?? "Unknown piece")
                  : "Unknown piece"}
              </span>
              {swaps > 0 ? (
                <span
                  className="shrink-0 text-[10px] text-muted-foreground"
                  title={`${swaps} interchangeable cop${swaps === 1 ? "y" : "ies"}`}
                >
                  +{swaps}
                </span>
              ) : null}
              {piece?.isExotic ? (
                <span className="shrink-0 rounded-none border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500">
                  Exotic
                </span>
              ) : null}
              {piece ? (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {pieceLocationLabel(piece)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </article>
  );
}
