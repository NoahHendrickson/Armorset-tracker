import { type ClassValue } from "clsx";
import { cn } from "@/lib/utils";

/** Default + hover foreground; focus ring matches header/canvas squares. */
const chromeDarkSquareIconFg =
  "text-white/80 transition-colors hover:bg-[#3a3b3f] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60";

/**
 * Standalone 40×40 bordered dark chrome square (nav header, floating canvas tools,
 * dialogs). Shadow matches existing header cluster styling.
 */
export function chromeStandaloneSquareIconButtonClass(...extra: ClassValue[]) {
  return cn(
    "flex size-10 shrink-0 items-center justify-center rounded-none border border-white/10 bg-[#2d2e32] shadow-lg",
    chromeDarkSquareIconFg,
    ...extra,
  );
}

/**
 * First tile inside a shared `chromeToolbarShellClass` wrapper (full square hit area).
 */
export function chromeToolbarInsetPrimaryTileClass(...extra: ClassValue[]) {
  return cn(
    "flex size-10 shrink-0 items-center justify-center",
    chromeDarkSquareIconFg,
    ...extra,
  );
}

/**
 * Adjunct tile (`border-l`) inside toolbar shell — e.g. cluster menu chevron at `w-9`.
 */
export function chromeToolbarInsetSegmentTileClass(...extra: ClassValue[]) {
  return cn(
    "flex h-10 w-9 shrink-0 items-center justify-center border-l border-white/15",
    chromeDarkSquareIconFg,
    "focus-visible:ring-inset disabled:pointer-events-none",
    ...extra,
  );
}

/** Bordered wrapper for inset primary + segment tiles (arrange cluster). */
export const chromeToolbarShellClass =
  "flex h-10 shrink-0 overflow-hidden rounded-none border border-white/10 bg-[#2d2e32] shadow-lg";

/**
 * Profile-strip sign-out: same height as `size-10`, left divider only — no standalone shadow/border.
 */
export function chromeSquareIconSegmentClass(...extra: ClassValue[]) {
  return cn(
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-none border-l border-white/15 text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/35",
    ...extra,
  );
}
