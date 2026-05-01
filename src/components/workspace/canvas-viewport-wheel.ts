import type { ReactZoomPanPinchContentRef } from "react-zoom-pan-pinch";

const LINE_HEIGHT = 16;

function clampScale(scale: number, minS: number, maxS = 6): number {
  const lo = Math.max(Number.EPSILON, minS);
  return Math.min(maxS, Math.max(lo, scale));
}

/**
 * Walks target→boundary looking for a scroll container that still has room
 * to scroll in the wheel direction — i.e. mimicking the browser's built-in
 * nested scroll-chaining. Returns the element we should defer to (if any).
 *
 * Cheap path first: skip the `getComputedStyle` call unless the element has
 * actual overflowing content. Accepts any Element (SVG targets included).
 */
function findScrollableAncestor(
  target: Element,
  boundary: Element,
  dx: number,
  dy: number,
): HTMLElement | null {
  const dominantY = Math.abs(dy) >= Math.abs(dx);
  let el: Element | null = target;
  while (el && el !== boundary) {
    // SVG elements report scrollHeight/clientHeight based on viewBox/intrinsic
    // size (e.g. a 20×20 icon with viewBox="0 0 256 256" reports 256 vs 20),
    // so they'd masquerade as a scroll container. Skip them — only HTML
    // elements participate in HTML overscroll chaining.
    if (!(el instanceof HTMLElement)) {
      el = el.parentElement;
      continue;
    }
    const overflowingY = el.scrollHeight > el.clientHeight;
    const overflowingX = el.scrollWidth > el.clientWidth;
    if (overflowingY || overflowingX) {
      const style = window.getComputedStyle(el);
      if (dominantY && overflowingY) {
        const scroll = style.overflowY;
        if (scroll === "auto" || scroll === "scroll") {
          const atTop = el.scrollTop <= 0;
          const atBottom =
            el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
          if ((dy < 0 && !atTop) || (dy > 0 && !atBottom)) return el;
        }
      }
      if (!dominantY && overflowingX) {
        const scroll = style.overflowX;
        if (scroll === "auto" || scroll === "scroll") {
          const atLeft = el.scrollLeft <= 0;
          const atRight =
            el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
          if ((dx < 0 && !atLeft) || (dx > 0 && !atRight)) return el;
        }
      }
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Document-level wheel handler (runs in capture + non-passive so we can
 * pre-empt native scroll-zoom and drive the canvas ourselves).
 *
 * Listens on `document` rather than the canvas surface so wheel events
 * fired over overlay UI — e.g. the floating app header that sits above the
 * canvas at z-40 — still drive pan/zoom. Without document-level capture,
 * trackpad swipes/pinches that started over the header would hit the
 * header element and never reach the surface, breaking pan and zoom in the
 * top strip of the page.
 *
 * Figma-style conventions:
 * - Two-finger trackpad swipe (pixel-mode wheel, no modifier) → pan
 * - Mouse wheel (line/page-mode, no modifier)                  → pan vertical
 *     (shift swaps to horizontal — matches Figma / most browsers)
 * - Trackpad pinch (wheel + ctrlKey from the OS synthetic pinch) → zoom-to-cursor
 * - Cmd/Ctrl + wheel                                            → zoom-to-cursor
 *
 * Nested-scroll chaining: if the wheel is over a child scroll container that
 * still has room in the event direction (e.g. an overflowing tracker body,
 * an open dialog with a scrollable body, a Select dropdown), we defer to
 * the browser so that container scrolls. Otherwise the canvas always wins —
 * even over a non-scrolling tracker, so 2-finger pans don't "stick" when
 * the cursor crosses a tracker.
 *
 * Zoom math mirrors react-zoom-pan-pinch's internal
 * `handleCalculateZoomPositions`: newPos = pos - mouseContent * (newScale - scale).
 */
export function attachCanvasViewportWheel(
  surface: HTMLElement,
  getApi: () => ReactZoomPanPinchContentRef | null | undefined,
  getMinScale: () => number,
): () => void {
  const onWheel = (e: WheelEvent) => {
    // Targets may be SVG elements (icon paths), so use the general Element
    // interface — HTMLElement would miss Phosphor icon hits and make the
    // handler silently no-op as the cursor passes over them.
    const t = e.target;
    if (!t || !(t instanceof Element)) return;

    // While a Radix modal/alert dialog is open, leave wheels outside the
    // dialog content alone. The dialog and its scrollable body handle their
    // own scrolling internally; we just don't want canvas pan/zoom firing
    // through the backdrop.
    const openModal = document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
    );
    if (openModal && !openModal.contains(t)) return;

    const api = getApi();
    if (!api?.state || typeof api.setTransform !== "function") return;

    const { positionX: px, positionY: py, scale } = api.state;
    const minS = Math.max(Number.EPSILON, getMinScale());

    const isZoomGesture = e.ctrlKey || e.metaKey;

    let dx = e.deltaX;
    let dy = e.deltaY;
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      dx *= LINE_HEIGHT;
      dy *= LINE_HEIGHT;
    } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      dx *= surface.clientWidth;
      dy *= surface.clientHeight;
    }

    // For pan gestures, defer to any scrollable ancestor (dialogs, dropdowns,
    // tracker bodies) that can still scroll in the wheel direction. Zoom
    // gestures always route to canvas.
    if (!isZoomGesture) {
      const scrollable = findScrollableAncestor(t, document.body, dx, dy);
      if (scrollable) return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();

    if (isZoomGesture) {
      // Sensitivity differs dramatically between pointer types:
      //   PIXEL (trackpad pinch / precision wheels) sends tiny deltas at ~60Hz
      //   LINE  (classic mouse wheel) sends chunky discrete ticks (~3 per click)
      // Tuned so a natural trackpad pinch feels snappy and a wheel click steps
      // the zoom by ~18–20%.
      const rawDy = e.deltaY;
      const k =
        e.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? 0.01 : 0.07;
      const factor = Math.exp(-rawDy * k);
      const nextScale = clampScale(scale * factor, minS);
      if (nextScale === scale) return;

      const content = api.instance.contentComponent;
      if (!content) {
        api.setTransform(px, py, nextScale, 0);
        return;
      }

      // Mouse position in content (pre-scale) coordinates.
      const contentRect = content.getBoundingClientRect();
      const mouseContentX = (e.clientX - contentRect.left) / scale;
      const mouseContentY = (e.clientY - contentRect.top) / scale;

      const scaleDiff = nextScale - scale;
      api.setTransform(
        px - mouseContentX * scaleDiff,
        py - mouseContentY * scaleDiff,
        nextScale,
        0,
      );
      return;
    }

    if (dx === 0 && dy === 0) return;
    // No modifier → pan. Browsers already swap dx/dy when shift is held on
    // a vertical wheel, so we don't need to re-swap here.
    api.setTransform(px - dx, py - dy, scale, 0);
  };

  const opts: AddEventListenerOptions = { passive: false, capture: true };
  document.addEventListener("wheel", onWheel, opts);
  return () => document.removeEventListener("wheel", onWheel, opts);
}
