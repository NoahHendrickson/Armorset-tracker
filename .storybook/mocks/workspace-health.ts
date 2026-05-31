import type { WorkspaceDataHealth } from "@/lib/workspace/workspace-data-health.shared";

const syncedAt = "2026-05-30T12:00:00.000Z";

export const MOCK_WORKSPACE_HEALTH_LOADED: WorkspaceDataHealth = {
  manifestVersion: "mock-version",
  manifestReady: true,
  manifestNeedsSync: false,
  inventorySyncedAt: syncedAt,
  inventoryStale: false,
  inventoryPieceCount: 6,
  hasInventoryCache: true,
};

export const MOCK_WORKSPACE_HEALTH_NO_CACHE: WorkspaceDataHealth = {
  manifestVersion: "mock-version",
  manifestReady: true,
  manifestNeedsSync: false,
  inventorySyncedAt: null,
  inventoryStale: true,
  inventoryPieceCount: 0,
  hasInventoryCache: false,
};

export const MOCK_WORKSPACE_HEALTH_EMPTY_CACHE: WorkspaceDataHealth = {
  manifestVersion: "mock-version",
  manifestReady: true,
  manifestNeedsSync: false,
  inventorySyncedAt: syncedAt,
  inventoryStale: false,
  inventoryPieceCount: 0,
  hasInventoryCache: true,
};

export const MOCK_WORKSPACE_HEALTH_NO_MANIFEST: WorkspaceDataHealth = {
  manifestVersion: null,
  manifestReady: false,
  manifestNeedsSync: true,
  inventorySyncedAt: null,
  inventoryStale: true,
  inventoryPieceCount: 0,
  hasInventoryCache: false,
};
