"use client";

import { ArmorStatIcon } from "@/components/ui/armor-stat-icon";
import { ARMOR_STAT_NAMES, type ArmorStatName } from "@/lib/db/types";
import {
  OPTIMIZER_STAT_MAX,
  pctOnOptimizerTrack,
} from "@/lib/optimizer/stat-range";
import type { StatBounds } from "@/lib/optimizer/types";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import { cn } from "@/lib/utils";

export type TheoreticalStatMaxesProps = {
  bounds: StatBounds;
  statIconByName?: GridLookupPayload["statIconByName"];
  className?: string;
};

export function TheoreticalStatMaxes({
  bounds,
  statIconByName = {},
  className,
}: TheoreticalStatMaxesProps) {
  return (
    <ul className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {ARMOR_STAT_NAMES.map((stat) => (
        <StatMaxRow
          key={stat}
          stat={stat}
          max={bounds[stat].max}
          iconPath={statIconByName[stat]}
        />
      ))}
    </ul>
  );
}

function StatMaxRow({
  stat,
  max,
  iconPath,
}: {
  stat: ArmorStatName;
  max: number;
  iconPath?: string;
}) {
  const pct = pctOnOptimizerTrack(max);

  return (
    <li className="flex flex-col gap-1.5 rounded-none border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ArmorStatIcon stat={stat} iconPath={iconPath} size="sm" />
          <span className="text-sm font-medium">{stat}</span>
        </div>
        <span className="tabular-nums text-sm font-semibold">
          {max}
          <span className="text-xs font-normal text-muted-foreground">
            {" "}
            / {OPTIMIZER_STAT_MAX}
          </span>
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-none bg-border"
        role="presentation"
        aria-hidden
      >
        <div
          className="h-full bg-primary transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}
