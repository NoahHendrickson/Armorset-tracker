/** Logical size of the pannable workspace (content layer beneath zoom). */
export const WORKSPACE_CANVAS_WIDTH = 4800;
export const WORKSPACE_CANVAS_HEIGHT = 3600;

/**
 * Fixed tracker width — sized to fit the full stat grid without clipping.
 * Breakdown: 36px sidebar + 2px main-panel border + 32px body padding +
 * (120px slot column + 4 × 100px stat columns) = 590px. Height stays
 * user-resizable, width does not.
 */
export const TRACKER_WIDTH = 590;

/**
 * Fixed tracker height — sized to hug the header + full stat grid with no
 * empty space below the last row:
 *   78 header + 1 border + 16 body pad-top + (24 grid header row +
 *   16 gap + 5 × 48 body rows) + 8 body pad-bottom = 383px.
 * Rounded up for breathing room. Not user-resizable.
 */
export const TRACKER_DEFAULT_HEIGHT = 384;
