import { inventoryCacheNeedsSync } from "@/lib/inventory/cache-status";

export interface WorkspaceDataHealth {
  manifestVersion: string | null;
  /** Derived tables populated and usable for inventory + filters. */
  manifestReady: boolean;
  /** Manifest missing, schema outdated, or live Bungie version ahead of cache. */
  manifestNeedsSync: boolean;
  inventorySyncedAt: string | null;
  inventoryStale: boolean;
  inventoryPieceCount: number;
  /** True when an `inventory_cache` row exists (even if empty). */
  hasInventoryCache: boolean;
}

export type WorkspaceSyncPhase = "idle" | "syncingManifest" | "syncingInventory";

export function buildWorkspaceDataHealth(input: {
  manifestVersion: string | null;
  schemaOutdated: boolean;
  manifestNeedsSync: boolean;
  inventorySyncedAt: string | null;
  inventoryPieceCount: number;
  hasInventoryCache: boolean;
}): WorkspaceDataHealth {
  const manifestReady =
    input.manifestVersion !== null && !input.schemaOutdated;
  return {
    manifestVersion: input.manifestVersion,
    manifestReady,
    manifestNeedsSync: input.manifestNeedsSync,
    inventorySyncedAt: input.inventorySyncedAt,
    inventoryStale: inventoryCacheNeedsSync(input.inventorySyncedAt),
    inventoryPieceCount: input.inventoryPieceCount,
    hasInventoryCache: input.hasInventoryCache,
  };
}

const CLASS_LABELS: Record<number, string> = {
  0: "Titan",
  1: "Hunter",
  2: "Warlock",
};

export type InventoryTableEmptyKind =
  | "syncing-manifest"
  | "syncing-inventory"
  | "manifest-error"
  | "inventory-error"
  | "reauth"
  | "no-cache"
  | "empty-inventory"
  | "empty-filters";

export interface InventoryTableEmptyState {
  kind: InventoryTableEmptyKind;
  title: string;
  detail: string;
}

/** When non-null, replace the virtualized body with a guided empty state. */
export function inventoryTableEmptyState(opts: {
  health: WorkspaceDataHealth;
  phase: WorkspaceSyncPhase;
  manifestError: string | null;
  inventoryError: string | null;
  reauthMessage: string | null;
  filteredCount: number;
  classType: number;
  filtersExcludeAll: boolean;
}): InventoryTableEmptyState | null {
  if (opts.reauthMessage) {
    return {
      kind: "reauth",
      title: "Reconnect Bungie",
      detail: opts.reauthMessage,
    };
  }

  if (opts.phase === "syncingManifest") {
    return {
      kind: "syncing-manifest",
      title: "Loading Destiny manifest",
      detail:
        "Sets, archetypes, and tunings are being pulled from Bungie. This runs once per environment and usually takes under a minute.",
    };
  }

  if (opts.manifestError) {
    return {
      kind: "manifest-error",
      title: "Manifest sync failed",
      detail: opts.manifestError,
    };
  }

  if (!opts.health.manifestReady) {
    return {
      kind: "syncing-manifest",
      title: "Manifest not ready",
      detail:
        "Armor names and tuning data come from the Bungie manifest. This loads automatically on first visit — usually under a minute.",
    };
  }

  if (!opts.health.hasInventoryCache) {
    return {
      kind: "syncing-inventory",
      title: "Fetching your armor",
      detail:
        "Pulling vault and character inventory from Bungie. This happens automatically after sign-in — no refresh needed unless it stalls.",
    };
  }

  if (opts.inventoryError) {
    return {
      kind: "inventory-error",
      title: "Inventory refresh failed",
      detail: opts.inventoryError,
    };
  }

  if (opts.health.inventoryPieceCount === 0) {
    return {
      kind: "empty-inventory",
      title: "No Armor 3.0 pieces found",
      detail:
        "Your inventory synced successfully but no eligible armor was returned. Try Refresh in the header, or check /debug for raw counts.",
    };
  }

  if (opts.filteredCount === 0 && opts.filtersExcludeAll) {
    const classLabel = CLASS_LABELS[opts.classType] ?? "this class";
    return {
      kind: "empty-filters",
      title: "No armor matches these filters",
      detail: `Nothing in your synced inventory matches the current filters for ${classLabel}. Clear filters or switch class to see more.`,
    };
  }

  if (opts.filteredCount === 0 && opts.health.inventoryPieceCount > 0) {
    const classLabel = CLASS_LABELS[opts.classType] ?? "this class";
    return {
      kind: "empty-filters",
      title: `No armor for ${classLabel}`,
      detail:
        "Your inventory synced, but nothing matches this class and rarity. Switch class or change the rarity filter.",
    };
  }

  return null;
}

/** Sync/inventory loading and error states that block the workspace canvas. */
export function isWorkspaceSyncGateState(
  state: InventoryTableEmptyState | null,
): state is InventoryTableEmptyState {
  if (!state) return false;
  return (
    state.kind === "syncing-manifest" ||
    state.kind === "syncing-inventory" ||
    state.kind === "manifest-error" ||
    state.kind === "inventory-error" ||
    state.kind === "reauth"
  );
}
