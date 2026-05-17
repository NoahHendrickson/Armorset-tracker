"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";

const PERSIST_DEBOUNCE_MS = 500;

/**
 * Hydrates dashboard filter state from the server blob and PATCHes `/api/me/workspace`
 * on change (debounced), shared by grid and table dashboard modes.
 */
export function useGridFiltersPersistence(
  initialFilters: GridFiltersJson,
): {
  filters: GridFiltersJson;
  onFiltersChange: (next: GridFiltersJson) => void;
} {
  const [filters, setFilters] = useState(initialFilters);

  const pendingFiltersRef = useRef<GridFiltersJson | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(async () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const next = pendingFiltersRef.current;
    if (next === null) return;
    pendingFiltersRef.current = null;
    try {
      const res = await fetch("/api/me/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gridFilters: next }),
      });
      if (!res.ok) {
        toast.error("Could not save filter selections.");
      }
    } catch {
      toast.error("Could not save filter selections.");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pendingFiltersRef.current !== null) {
        void flush();
      }
    };
  }, [flush]);

  const onFiltersChange = useCallback(
    (next: GridFiltersJson) => {
      setFilters(next);
      pendingFiltersRef.current = next;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), PERSIST_DEBOUNCE_MS);
    },
    [flush],
  );

  return { filters, onFiltersChange };
}
