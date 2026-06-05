"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type {
  DerivedArmorPieceJson,
  InventoryDropFeedEntry,
} from "@/lib/db/types";

const dropFeedToastDefaults = {
  style: { borderRadius: 0 },
  classNames: { toast: "rounded-none", success: "rounded-none" },
} as const;

function mergeFeedEntries(
  existing: InventoryDropFeedEntry[],
  incoming: InventoryDropFeedEntry[],
): InventoryDropFeedEntry[] {
  const byId = new Map<string, InventoryDropFeedEntry>();
  for (const entry of incoming) {
    byId.set(entry.itemInstanceId, entry);
  }
  for (const entry of existing) {
    if (!byId.has(entry.itemInstanceId)) {
      byId.set(entry.itemInstanceId, entry);
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime(),
  );
}

function piecesToEntries(
  pieces: DerivedArmorPieceJson[],
  firstSeenAt: string,
): InventoryDropFeedEntry[] {
  return pieces.map((piece) => ({
    itemInstanceId: piece.itemInstanceId,
    firstSeenAt,
    piece,
  }));
}

export interface InventorySyncDropFeedPayload {
  syncedAt?: string;
  newPieces?: DerivedArmorPieceJson[];
}

interface InventoryDropFeedContextValue {
  feed: InventoryDropFeedEntry[];
  setFeed: (entries: InventoryDropFeedEntry[]) => void;
  prependFromSync: (payload: InventorySyncDropFeedPayload) => void;
  clearFeed: () => Promise<void>;
  dismissEntry: (itemInstanceId: string) => Promise<void>;
}

const InventoryDropFeedContext =
  createContext<InventoryDropFeedContextValue | null>(null);

export function InventoryDropFeedProvider({
  initialFeed,
  children,
}: {
  initialFeed: InventoryDropFeedEntry[];
  children: ReactNode;
}) {
  const [feed, setFeed] = useState(initialFeed);

  const prependFromSync = useCallback((payload: InventorySyncDropFeedPayload) => {
    const pieces = payload.newPieces;
    if (!pieces || pieces.length === 0) return;
    const firstSeenAt = payload.syncedAt ?? new Date().toISOString();
    const incoming = piecesToEntries(pieces, firstSeenAt);
    setFeed((prev) => mergeFeedEntries(prev, incoming));
    const n = pieces.length;
    toast.success(
      n === 1 ? "1 new armor piece added to feed." : `${n} new armor pieces added to feed.`,
      dropFeedToastDefaults,
    );
  }, []);

  const clearFeed = useCallback(async () => {
    const res = await fetch("/api/inventory/drop-feed", {
      method: "DELETE",
      credentials: "include",
    });
    const body = (await res.json()) as {
      error?: string;
      feed?: InventoryDropFeedEntry[];
    };
    if (!res.ok) {
      toast.error(body.error ?? "Could not clear feed", dropFeedToastDefaults);
      return;
    }
    setFeed(Array.isArray(body.feed) ? body.feed : []);
  }, []);

  const dismissEntry = useCallback(async (itemInstanceId: string) => {
    const res = await fetch(
      `/api/inventory/drop-feed?itemInstanceId=${encodeURIComponent(itemInstanceId)}`,
      { method: "DELETE", credentials: "include" },
    );
    const body = (await res.json()) as {
      error?: string;
      feed?: InventoryDropFeedEntry[];
    };
    if (!res.ok) {
      toast.error(body.error ?? "Could not dismiss", dropFeedToastDefaults);
      return;
    }
    setFeed(Array.isArray(body.feed) ? body.feed : []);
  }, []);

  const value = useMemo(
    () => ({
      feed,
      setFeed,
      prependFromSync,
      clearFeed,
      dismissEntry,
    }),
    [feed, prependFromSync, clearFeed, dismissEntry],
  );

  return (
    <InventoryDropFeedContext.Provider value={value}>
      {children}
    </InventoryDropFeedContext.Provider>
  );
}

export function useInventoryDropFeed(): InventoryDropFeedContextValue {
  const ctx = useContext(InventoryDropFeedContext);
  if (!ctx) {
    throw new Error("useInventoryDropFeed must be used within InventoryDropFeedProvider");
  }
  return ctx;
}

/** For refresh control outside the dashboard feed tree (no-op when absent). */
export function useInventoryDropFeedOptional(): InventoryDropFeedContextValue | null {
  return useContext(InventoryDropFeedContext);
}
