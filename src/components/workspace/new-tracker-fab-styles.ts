import type { CSSProperties } from "react";

/** Matches the workspace “New tracker” FAB surface (brand-green pill + layered shadow). */
export const NEW_TRACKER_FAB_CLASSES =
  "relative flex h-12 shrink-0 items-center gap-2 overflow-hidden rounded-none bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60";

export const NEW_TRACKER_FAB_SHADOW: CSSProperties = {
  boxShadow:
    "0 10px 20px -5px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.24), inset 0 -10px 14px -4px rgba(255,255,255,0.16)",
};
