"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// `useLayoutEffect` warns when it runs on the server, but client components are
// still server-rendered for the initial HTML. Fall back to `useEffect` there;
// the indicator stays hidden (`indicatorReady === false`) until measured, so
// there is no hydration mismatch either way.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface SlidingIndicator {
  /** Attach to the segment container (the indicator is positioned relative to it). */
  groupRef: React.RefObject<HTMLDivElement | null>;
  /** Ref callback for each segment button, by index. */
  registerTab: (index: number) => (node: HTMLButtonElement | null) => void;
  /** Inline `left`/`width` (px) for the indicator element. */
  indicatorStyle: { left: number; width: number };
  /** False until the first measurement lands — hide the indicator so it doesn't flash at 0,0. */
  indicatorReady: boolean;
  /** True while a slide is in flight — gate the transition on this so it never animates on first paint. */
  animating: boolean;
  /** Call on a user-driven active-index change to enable the slide. */
  beginSlide: () => void;
  /** Wire to the indicator's `onTransitionEnd` to reset `animating`. */
  endSlide: () => void;
}

/**
 * Measures the active segment in a segmented control and exposes the geometry
 * for a sliding indicator pill. Re-measures on active-index change and on
 * container resize. Shared by `ClassSwitcher` and `WorkspaceViewModeTabs`.
 */
export function useSlidingIndicator(activeIndex: number): SlidingIndicator {
  const groupRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [indicatorReady, setIndicatorReady] = useState(false);
  const [animating, setAnimating] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const update = () => {
      const group = groupRef.current;
      const tab = activeIndex >= 0 ? tabRefs.current[activeIndex] : null;
      if (!group || !tab) return;
      const groupRect = group.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      setIndicatorStyle({
        left: tabRect.left - groupRect.left,
        width: tabRect.width,
      });
      setIndicatorReady(true);
    };

    update();
    const group = groupRef.current;
    if (!group) return;
    const observer = new ResizeObserver(update);
    observer.observe(group);
    return () => observer.disconnect();
  }, [activeIndex]);

  return {
    groupRef,
    registerTab: (index) => (node) => {
      tabRefs.current[index] = node;
    },
    indicatorStyle,
    indicatorReady,
    animating,
    beginSlide: () => setAnimating(true),
    endSlide: () => setAnimating(false),
  };
}
