"use client";

import { bungieIconUrl } from "@/lib/bungie/constants";
import type { ArmorStatName } from "@/lib/db/types";
import { cn } from "@/lib/utils";

/** Bungie raster stat icons are neutral-on-transparent; match tracker tuning glyphs. */
const STAT_ICON_FILTER =
  "brightness(0) saturate(100%) invert(100%)";

export interface ArmorStatIconProps {
  stat: ArmorStatName;
  iconPath?: string | null;
  size?: "sm" | "md";
  className?: string;
  title?: string;
}

const sizeClass = {
  sm: "size-5",
  md: "size-6",
} as const;

/**
 * Manifest stat icon for Armor 3.0 stats (Weapons, Health, etc.).
 */
export function ArmorStatIcon({
  stat,
  iconPath,
  size = "md",
  className,
  title,
}: ArmorStatIconProps) {
  const label = title ?? stat;
  if (!iconPath) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-none border border-border bg-muted text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
          sizeClass[size],
          className,
        )}
        aria-label={label}
        title={label}
      >
        {stat.slice(0, 1)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Bungie CDN
    <img
      src={bungieIconUrl(iconPath)}
      alt=""
      width={size === "sm" ? 20 : 24}
      height={size === "sm" ? 20 : 24}
      className={cn("shrink-0 object-contain", sizeClass[size], className)}
      style={{ filter: STAT_ICON_FILTER }}
      title={label}
      aria-hidden
    />
  );
}
