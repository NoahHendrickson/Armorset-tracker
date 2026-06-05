"use client";

import { useMemo } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import type { InventoryDropFeedEntry } from "@/lib/db/types";
import { bungieIconUrl } from "@/lib/bungie/constants";
import { inventoryPieceDisplayName } from "@/lib/filters/filter-inventory";
import { formatDropFeedRelativeTime } from "@/lib/inventory/format-drop-feed-time";
import { useInventoryDropFeed } from "@/components/dashboard/inventory-drop-feed-context";
import { useWorkspaceSync } from "@/components/dashboard/workspace-sync-status";
import { Button } from "@/components/ui/button";

function feedSubtitle(entry: InventoryDropFeedEntry): string {
  const p = entry.piece;
  const parts = [p.archetypeName, p.tertiaryStat, p.tuningName].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

interface NewArmorFeedPanelProps {
  inventorySyncedAt: string | null;
}

export function NewArmorFeedPanel({ inventorySyncedAt }: NewArmorFeedPanelProps) {
  const { feed, clearFeed, dismissEntry } = useInventoryDropFeed();
  const { phase } = useWorkspaceSync();
  const syncing = phase === "syncingInventory";

  const lastSyncedLabel = useMemo(() => {
    if (!inventorySyncedAt) return "Not synced yet";
    return `Synced ${formatDropFeedRelativeTime(inventorySyncedAt)}`;
  }, [inventorySyncedAt]);

  return (
    <aside
      className="flex w-[14rem] shrink-0 flex-col bg-card"
      aria-label="New armor drops"
    >
      <div className="flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            New drops
          </h2>
          <p className="mt-0.5 text-[10px] text-muted-foreground/80">
            {syncing ? "Syncing…" : lastSyncedLabel}
          </p>
        </div>
        {feed.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-[10px] text-muted-foreground"
            onClick={() => void clearFeed()}
          >
            Clear
          </Button>
        ) : null}
      </div>

      <div className="menu-scrollbar min-h-0 flex-1 overflow-y-auto">
        {feed.length === 0 ? (
          <p className="px-3 py-4 text-xs leading-relaxed text-muted-foreground/80">
            New drops appear after inventory sync. Use Refresh or wait for the
            automatic sync.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {feed.map((entry) => {
              const name =
                inventoryPieceDisplayName(entry.piece) ??
                entry.piece.setName ??
                "Armor";
              return (
                <li key={entry.itemInstanceId} className="group relative">
                  <div className="flex gap-2 px-3 py-2 pr-8">
                    {entry.piece.iconPath ? (
                      <span className="inline-flex shrink-0 rounded-none border border-border bg-accent leading-none">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={bungieIconUrl(entry.piece.iconPath)}
                          alt=""
                          className="block size-8 object-contain"
                          loading="lazy"
                        />
                      </span>
                    ) : (
                      <span
                        className="inline-block size-8 shrink-0 rounded-none border border-border bg-accent/60"
                        aria-hidden
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {name}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {feedSubtitle(entry)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                        {formatDropFeedRelativeTime(entry.firstSeenAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="absolute right-1 top-2 flex size-6 items-center justify-center text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Dismiss ${name} from feed`}
                    onClick={() => void dismissEntry(entry.itemInstanceId)}
                  >
                    <X className="size-3.5" weight="bold" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
