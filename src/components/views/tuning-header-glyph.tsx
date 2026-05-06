"use client";

import { bungieIconUrl } from "@/lib/bungie/constants";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Same border, fill, type scale as set/archetype badges on the tracker header. */
const tuningBadgeClass =
  "inline-flex shrink-0 cursor-default items-center gap-2 rounded-none border border-[#00FF85] bg-[#00FF85]/14 px-3 py-1.5 text-sm font-medium leading-snug text-white shadow-none";

interface TuningHeaderGlyphProps {
  tuningName: string;
  /** Manifest-relative icon path; null when tuning string is ambiguous or icons missing */
  iconPath: string | null;
}

/**
 * Bungie raster stat icons → brand green (#00FF85) via CSS filter (icons are neutral-on-transparent).
 */
const TUNING_ICON_FILTER =
  "brightness(0) saturate(100%) invert(67%) sepia(98%) saturate(434%) hue-rotate(84deg) brightness(105%) contrast(105%)";

/**
 * Tuning pill for tracker headers: manifest icon + “Tuning” (full stat in tooltip).
 */
export function TuningHeaderGlyph({ tuningName, iconPath }: TuningHeaderGlyphProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={tuningBadgeClass}
          aria-label={`Tuning: ${tuningName}`}
        >
          {iconPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- Bungie CDN
            <img
              src={bungieIconUrl(iconPath)}
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 shrink-0 object-contain"
              style={{ filter: TUNING_ICON_FILTER }}
            />
          ) : (
            <span
              aria-hidden
              className="flex h-5 w-5 shrink-0 items-center justify-center text-xs font-semibold text-white/80"
            >
              +
            </span>
          )}
          <span>Tuning</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Tuning: {tuningName}</TooltipContent>
    </Tooltip>
  );
}
