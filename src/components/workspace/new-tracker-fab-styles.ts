import type { CSSProperties } from "react";

/** Matches the workspace “New tracker” FAB surface (green pill + layered shadow). */
export const NEW_TRACKER_FAB_CLASSES =
  "relative flex h-12 shrink-0 items-center gap-2 overflow-hidden rounded-none bg-[#07ad6b] px-6 text-sm font-medium text-white transition-colors hover:bg-[#0ac07a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07ad6b] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60";

export const NEW_TRACKER_FAB_SHADOW: CSSProperties = {
  boxShadow:
    "0 10px 20px -5px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.24), inset 0 -10px 14px -4px rgba(255,255,255,0.16)",
};
