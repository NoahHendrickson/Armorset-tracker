"use client";

import {
  SLOT_LABELS,
  bungieIconUrl,
  type ArmorSlot,
} from "@/lib/bungie/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Row header for armor slot columns on tracker grids (bucket icon + name tooltip). */
export function ArmorSlotTrackerRowHeader({
  slot,
  iconPath,
  isLastRow,
  className,
  tooltipSide = "right",
}: {
  slot: ArmorSlot;
  iconPath: string | undefined;
  isLastRow: boolean;
  className?: string;
  tooltipSide?: "left" | "right";
}) {
  const label = SLOT_LABELS[slot];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="rowheader"
          aria-label={label}
          className={cn(
            "flex h-12 items-center justify-center p-2 text-base font-medium text-white",
            !isLastRow && "border-b border-white/10",
            className,
          )}
        >
          {iconPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- Bungie CDN
            <img
              src={bungieIconUrl(iconPath)}
              alt=""
              className="h-8 w-8 shrink-0 object-contain opacity-90"
              loading="lazy"
            />
          ) : (
            <span className="truncate">{label}</span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}
