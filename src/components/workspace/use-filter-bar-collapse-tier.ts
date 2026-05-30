"use client";

import { useEffect, useState, type RefObject } from "react";
import {
  getFilterBarCollapseTier,
  type FilterBarCollapseTier,
} from "@/components/workspace/filter-bar-collapse-policy";

export type { FilterBarCollapseTier } from "@/components/workspace/filter-bar-collapse-policy";

export { getFilterBarCollapseTier } from "@/components/workspace/filter-bar-collapse-policy";

/** Observe filter-bar container width — required for portaled menus (container queries don't apply). */
export function useFilterBarCollapseTier(
  ref: RefObject<HTMLElement | null>,
): FilterBarCollapseTier {
  const [tier, setTier] = useState<FilterBarCollapseTier>("full-inline");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      setTier(getFilterBarCollapseTier(el.getBoundingClientRect().width));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return tier;
}
