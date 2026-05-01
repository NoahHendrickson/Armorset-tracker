import { bungieIconUrl } from "@/lib/bungie/constants";
import {
  TUNING_GLYPH_CENTER,
  TuningGlyphFrameSvg,
} from "@/components/views/tuning-glyph-frame";

interface TuningHeaderGlyphProps {
  tuningName: string;
  /** Manifest-relative icon path; null when tuning string is ambiguous or icons missing */
  iconPath: string | null;
}

/** Stat emblem vertical center as % of emblem box (circle cy / view height). */
const STAT_SLOT_TOP_PERCENT =
  TUNING_GLYPH_CENTER.y / TUNING_GLYPH_CENTER.viewHeight;

/**
 * Compact tuning mark for tracker headers — frame from `tuning-glyph-frame`
 * (replace with design export); dashed ring + Bungie stat art overlaid here.
 */
export function TuningHeaderGlyph({ tuningName, iconPath }: TuningHeaderGlyphProps) {
  const statSlotTopPct = `${STAT_SLOT_TOP_PERCENT * 100}%`;
  return (
    <div
      className="relative h-11 w-11 shrink-0 text-white/45"
      title={tuningName}
    >
      <TuningGlyphFrameSvg className="h-full w-full" />

      {/* Stat icon clipped to tuner center */}
      {iconPath ? (
        <div
          style={{ top: statSlotTopPct }}
          className="pointer-events-none absolute left-1/2 aspect-square w-[17px] -translate-x-1/2 -translate-y-1/2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Bungie CDN */}
          <img
            src={bungieIconUrl(iconPath)}
            alt=""
            className="size-full object-contain opacity-[0.95]"
          />
        </div>
      ) : (
        <div
          aria-hidden
          style={{ top: statSlotTopPct }}
          className="pointer-events-none absolute left-1/2 flex h-[17px] w-[17px] -translate-x-1/2 -translate-y-1/2 items-center justify-center text-[11px] font-medium text-white/50"
        >
          +
        </div>
      )}
      <span className="sr-only">Tuning: {tuningName}</span>
    </div>
  );
}
