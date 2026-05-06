/** Logical size of the pannable workspace (content layer beneath zoom). */
export const WORKSPACE_CANVAS_WIDTH = 16000;
export const WORKSPACE_CANVAS_HEIGHT = 12000;

/** Target for pan/zoom math and debugging — the bounded tracker layer. */
export const WORKSPACE_CANVAS_ELEMENT_ID = "workspace-canvas-root";

/** Fixed width of the slot / row-label column in the tracker grid (px). */
export const TRACKER_SLOT_COLUMN_WIDTH = 56;

/**
 * Fixed tracker width — sized to fit the full stat grid without clipping.
 * Breakdown: 36px sidebar + 2px main-panel border + 32px body padding +
 * ({@link TRACKER_SLOT_COLUMN_WIDTH}px slot column + 4 × 100px stat columns).
 * Height stays user-resizable, width does not.
 */
export const TRACKER_WIDTH =
  70 + TRACKER_SLOT_COLUMN_WIDTH + 4 * 100;

/** Horizontal chrome around the stat table: sidebar, main border, body padding. */
export const TRACKER_PANEL_CHROME_WIDTH =
  TRACKER_WIDTH - TRACKER_SLOT_COLUMN_WIDTH - 4 * 100;

/**
 * Tracker shell width for merged views: chrome + left slot rail + tertiary columns × 100 +
 * right slot rail.
 */
export function trackerWidthForTertiaryColumns(
  tertiaryColumnCount: number,
  options?: { dualSlotRails?: boolean },
): number {
  const slotRails = 1 + (options?.dualSlotRails ? 1 : 0);
  return (
    TRACKER_PANEL_CHROME_WIDTH +
    TRACKER_SLOT_COLUMN_WIDTH * slotRails +
    Math.max(0, tertiaryColumnCount) * 100
  );
}

/**
 * Fixed tracker height — sized to hug the header + full stat grid with no
 * empty space below the last row:
 *   78 header + 1 border + 16 body pad-top + (24 grid header row +
 *   16 gap + 5 × 48 body rows) + 8 body pad-bottom = 383px.
 * Rounded up for breathing room. Not user-resizable.
 */
export const TRACKER_DEFAULT_HEIGHT = 384;

/** `transform` ease when trackers move programmatically (sort/cluster arrange). */
export const ARRANGE_LAYOUT_EASE_DURATION_MS = 420;

export function arrangeLayoutEaseDurationMs(): number {
  if (typeof window === "undefined") {
    return ARRANGE_LAYOUT_EASE_DURATION_MS;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 1
    : ARRANGE_LAYOUT_EASE_DURATION_MS;
}
