/** Logical size of the pannable workspace (content layer beneath zoom). */
export const WORKSPACE_CANVAS_WIDTH = 16000;
export const WORKSPACE_CANVAS_HEIGHT = 12000;

/** Target for pan/zoom math and debugging — the bounded tracker layer. */
export const WORKSPACE_CANVAS_ELEMENT_ID = "workspace-canvas-root";

/**
 * Fixed tracker width — sized to fit the full stat grid without clipping.
 * Breakdown: 36px sidebar + 2px main-panel border + 32px body padding +
 * (120px slot column + 4 × 100px stat columns) = 590px. Height stays
 * user-resizable, width does not.
 */
export const TRACKER_WIDTH = 590;

/** Horizontal chrome around the stat table: sidebar, main border, body padding. */
export const TRACKER_PANEL_CHROME_WIDTH = TRACKER_WIDTH - 120 - 4 * 100;

/**
 * Tracker shell width for a given number of tertiary stat columns (120px slot
 * column + 100px × stats). Used for merged views whose union has more than
 * four tertiaries so the grid does not need horizontal scrolling.
 */
export function trackerWidthForTertiaryColumns(tertiaryColumnCount: number): number {
  return (
    TRACKER_PANEL_CHROME_WIDTH +
    120 +
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
