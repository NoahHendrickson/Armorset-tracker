import type { SVGAttributes } from "react";

/** ViewBox anchor for centering Bungie stat art in `tuning-header-glyph.tsx`. */
export const TUNING_GLYPH_CENTER = { x: 24, y: 21, viewHeight: 48 };

/**
 * Tuning emblem frame only (omit the tertiary stat emblem from design — we layer it in React).
 *
 * Swap the inner primitives below when you paste an export from Figma/etc. Prefer
 * `stroke="currentColor"` / `fill="currentColor"` so parent `text-white/45`
 * controls contrast on the charcoal tracker chrome.
 */
export function TuningGlyphFrameSvg(props: SVGAttributes<SVGSVGElement>) {
  const { className, ...rest } = props;
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...rest}
    >
      {/* Balance line through center */}
      <line
        x1={4}
        y1={24}
        x2={44}
        y2={24}
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="square"
      />
      {/* Upper-left + direction */}
      <path
        d="M11 18 L14 13 L17 18"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1={9}
        y1={19.5}
        x2={19}
        y2={19.5}
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      {/* Lower-right − direction */}
      <line
        x1={30}
        y1={26.5}
        x2={40}
        y2={26.5}
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <path
        d="M33 28.5 L36 35 L39 28.5"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dashed ring around stat emblem slot */}
      <circle
        cx={TUNING_GLYPH_CENTER.x}
        cy={TUNING_GLYPH_CENTER.y}
        r={9}
        stroke="currentColor"
        strokeWidth={1}
        strokeDasharray="3.2 5"
        strokeLinecap="round"
      />
    </svg>
  );
}
