"use client";

import { bungieIconUrl } from "@/lib/bungie/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TuningHeaderGlyphProps {
  tuningName: string;
  /** Manifest-relative icon path; null when tuning string is ambiguous or icons missing */
  iconPath: string | null;
}

/**
 * Tuning stat icon for tracker headers (Bungie manifest art only).
 */
export function TuningHeaderGlyph({ tuningName, iconPath }: TuningHeaderGlyphProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex shrink-0 cursor-default items-center gap-1.5 text-white/45">
          {iconPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- Bungie CDN
            <img
              src={bungieIconUrl(iconPath)}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain opacity-[0.95]"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center text-[11px] font-medium text-white/50"
            >
              +
            </span>
          )}
          <span className="text-sm font-medium leading-none" aria-hidden>
            Tuning
          </span>
          <span className="sr-only">
            Tuning: {tuningName}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>Tuning: {tuningName}</TooltipContent>
    </Tooltip>
  );
}
