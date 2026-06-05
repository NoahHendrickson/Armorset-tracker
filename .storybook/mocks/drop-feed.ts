import type { InventoryDropFeedEntry } from "@/lib/db/types";
import { MOCK_INVENTORY } from "./armor-pieces";

export const MOCK_DROP_FEED: InventoryDropFeedEntry[] = MOCK_INVENTORY.slice(0, 3).map(
  (piece, i) => ({
    itemInstanceId: piece.itemInstanceId,
    firstSeenAt: new Date(Date.now() - (i + 1) * 3600_000).toISOString(),
    piece,
  }),
);
