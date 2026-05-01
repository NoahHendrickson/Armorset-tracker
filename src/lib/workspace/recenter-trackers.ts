/**
 * Translate all tracker positions so their union bbox is centered on the
 * workspace canvas, clamped so every tracker rect stays inside the canvas.
 */

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export type TrackerTopLeft = { readonly x: number; readonly y: number };

/**
 * @param positions Top-left `(x,y)` for each tracker in canvas space (same coords
 *   repeated for stacked merge partners is fine — bbox is unchanged).
 * @returns Translation `(dx, dy)` such that `(x + dx, y + dy)` keeps all rects in
 *   `[0, canvasW - rectW] × [0, canvasH - rectH]` when feasible.
 */
export function computeRecenterTranslation(
  positions: readonly TrackerTopLeft[],
  canvasWidth: number,
  canvasHeight: number,
  rectWidth: number,
  rectHeight: number,
): { dx: number; dy: number } {
  if (positions.length === 0 || canvasWidth <= 0 || canvasHeight <= 0) {
    return { dx: 0, dy: 0 };
  }

  let minX = Infinity;
  let maxRight = -Infinity;
  let minY = Infinity;
  let maxBottom = -Infinity;

  for (const { x, y } of positions) {
    minX = Math.min(minX, x);
    maxRight = Math.max(maxRight, x + rectWidth);
    minY = Math.min(minY, y);
    maxBottom = Math.max(maxBottom, y + rectHeight);
  }

  const dxIdeal = canvasWidth / 2 - (minX + maxRight) / 2;
  const dyIdeal = canvasHeight / 2 - (minY + maxBottom) / 2;

  const dxLow = -minX;
  const dxHigh = canvasWidth - maxRight;
  const dyLow = -minY;
  const dyHigh = canvasHeight - maxBottom;

  const dxFeasible = dxLow <= dxHigh + 1e-9;
  const dyFeasible = dyLow <= dyHigh + 1e-9;

  const dx = dxFeasible ? clamp(dxIdeal, dxLow, dxHigh) : 0;
  const dy = dyFeasible ? clamp(dyIdeal, dyLow, dyHigh) : 0;
  return { dx, dy };
}
