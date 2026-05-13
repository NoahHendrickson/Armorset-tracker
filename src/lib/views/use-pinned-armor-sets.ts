"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "armor-checklist:pinned-armor-sets:v1";
const EMPTY: readonly string[] = Object.freeze([]);

function safeRead(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
  } catch {
    /* fall through */
  }
  return [];
}

/**
 * Module-scoped cache so multiple consumers see the same reference between
 * renders — `useSyncExternalStore` requires `getSnapshot` to return a stable
 * reference when the underlying value hasn't changed.
 */
let cachedRaw: string | null = null;
let cachedHashes: readonly string[] = EMPTY;
const subscribers = new Set<() => void>();
let storageListenerAttached = false;

function refreshFromStorage(): void {
  const raw = safeRead();
  if (raw === cachedRaw) return;
  cachedRaw = raw;
  cachedHashes = Object.freeze(parse(raw));
}

function notifySubscribers(): void {
  for (const cb of subscribers) cb();
}

function attachStorageListener(): void {
  if (storageListenerAttached || typeof window === "undefined") return;
  storageListenerAttached = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== null && e.key !== STORAGE_KEY) return;
    refreshFromStorage();
    notifySubscribers();
  });
}

function subscribe(cb: () => void): () => void {
  attachStorageListener();
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function getSnapshot(): readonly string[] {
  if (cachedRaw === null) {
    /* First read on client: hydrate cache from localStorage. */
    refreshFromStorage();
  }
  return cachedHashes;
}

function getServerSnapshot(): readonly string[] {
  return EMPTY;
}

function persist(next: readonly string[]): void {
  const raw = JSON.stringify(next);
  cachedRaw = raw;
  cachedHashes = Object.freeze(next.slice());
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, raw);
    } catch {
      /* storage disabled / quota exceeded — silently ignore */
    }
  }
  notifySubscribers();
}

export interface UsePinnedArmorSetsResult {
  /** Pinned armor set hashes (as strings) in pin order. */
  pinnedHashes: readonly string[];
  /** O(1) membership check. */
  isPinned: (hash: string) => boolean;
  /** Toggle pin state for one armor set hash. */
  togglePin: (hash: string) => void;
}

/**
 * localStorage-backed pinned armor set list. Per-browser; not synced across
 * devices. Pins float to the top of the armor set picker as a "Pinned sets"
 * section.
 *
 * Uses `useSyncExternalStore` so updates from other tabs (or from another
 * combobox in the same view) propagate immediately, and the SSR snapshot is
 * stable (empty list) which avoids hydration mismatches.
 */
export function usePinnedArmorSets(): UsePinnedArmorSetsResult {
  const pinnedHashes = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const pinnedSet = useMemo(() => new Set(pinnedHashes), [pinnedHashes]);

  const togglePin = useCallback((hash: string) => {
    const current = cachedHashes;
    const next = current.includes(hash)
      ? current.filter((h) => h !== hash)
      : [...current, hash];
    persist(next);
  }, []);

  const isPinned = useCallback(
    (hash: string) => pinnedSet.has(hash),
    [pinnedSet],
  );

  return { pinnedHashes, isPinned, togglePin };
}
