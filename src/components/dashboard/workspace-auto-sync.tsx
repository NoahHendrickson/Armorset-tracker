"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BUNGIE_REAUTH_REQUIRED_CODE,
  BUNGIE_RECONNECT_PATH,
  BUNGIE_REAUTH_USER_MESSAGE,
} from "@/lib/auth/bungie-reauth";
import {
  inventoryCacheNeedsSync,
  inventoryMsUntilResync,
} from "@/lib/inventory/cache-status";
import type { WorkspaceDataHealth } from "@/lib/workspace/workspace-data-health.shared";
import { useInventoryEquipmentOnlyAlert } from "@/components/dashboard/inventory-equipment-only-alert";
import { useWorkspaceSync } from "@/components/dashboard/workspace-sync-status";

interface WorkspaceAutoSyncProps {
  health: WorkspaceDataHealth;
}

type ManifestSyncResponse = {
  error?: string;
  maintenance?: boolean;
  version?: string;
  changed?: boolean;
  skipped?: boolean;
};

type InventorySyncResponse = {
  error?: string;
  code?: string;
  reconnectPath?: string;
  syncedAt?: string;
  itemCount?: number;
  warnings?: string[];
  equipmentOnlyRestricted?: boolean;
  cached?: boolean;
};

const manifestToastDefaults = {
  style: { borderRadius: 0 },
  classNames: { toast: "rounded-none" },
} as const;

/**
 * Coordinates manifest sync (when unhealthy) then inventory refresh (when stale
 * or after manifest sync). Mounted once from {@link DashboardWorkspace}.
 */
export function WorkspaceAutoSync({ health }: WorkspaceAutoSyncProps) {
  const router = useRouter();
  const equipmentOnlyAlert = useInventoryEquipmentOnlyAlert();
  const {
    setPhase,
    setManifestError,
    setInventoryError,
    setInventoryWarnings,
    setReauthMessage,
    registerRetry,
  } = useWorkspaceSync();

  const inFlightRef = useRef(false);
  const generationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSyncedAtRef = useRef(health.inventorySyncedAt);
  const manifestNeedsSyncRef = useRef(health.manifestNeedsSync);

  useEffect(() => {
    latestSyncedAtRef.current = health.inventorySyncedAt;
    manifestNeedsSyncRef.current = health.manifestNeedsSync;
  }, [health.inventorySyncedAt, health.manifestNeedsSync]);

  const handleReauth = useCallback(
    (message: string, reconnectPath?: string) => {
      setReauthMessage(message);
      toast.error(message, {
        duration: 22_000,
        action: {
          label: "Reconnect Bungie",
          onClick: () => {
            window.location.href = reconnectPath ?? BUNGIE_RECONNECT_PATH;
          },
        },
      });
    },
    [setReauthMessage],
  );

  const runManifestSync = useCallback(
    async (force: boolean): Promise<boolean> => {
      setManifestError(null);
      setPhase("syncingManifest");
      const url = force
        ? "/api/admin/manifest/sync?force=1"
        : "/api/admin/manifest/sync";
      try {
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
        });
        const body = (await res.json()) as ManifestSyncResponse;
        if (!res.ok) {
          if (body.maintenance) {
            setManifestError("Bungie API is in maintenance. Try again later.");
          } else {
            setManifestError(body.error ?? "Manifest sync failed");
          }
          return false;
        }
        if (body.changed) {
          toast.success(
            body.version
              ? `Manifest synced (${body.version.slice(0, 8)}…).`
              : "Manifest synced.",
            manifestToastDefaults,
          );
        }
        router.refresh();
        return true;
      } catch (err) {
        setManifestError(
          err instanceof Error ? err.message : "Manifest sync failed",
        );
        return false;
      } finally {
        setPhase("idle");
      }
    },
    [router, setManifestError, setPhase],
  );

  const runInventorySync = useCallback(
    async (force = false): Promise<string | null> => {
      setInventoryError(null);
      setPhase("syncingInventory");
      try {
        const url = force
          ? "/api/inventory/sync?force=1"
          : "/api/inventory/sync";
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
        });
        const body = (await res.json()) as InventorySyncResponse;

        if (!res.ok) {
          if (body.code === BUNGIE_REAUTH_REQUIRED_CODE) {
            handleReauth(
              body.error ?? BUNGIE_REAUTH_USER_MESSAGE,
              body.reconnectPath,
            );
          } else {
            const msg = body.error ?? "Inventory refresh failed";
            setInventoryError(msg);
            toast.error(msg, manifestToastDefaults);
          }
          return latestSyncedAtRef.current;
        }

        if (body.equipmentOnlyRestricted) {
          const detail =
            Array.isArray(body.warnings) && body.warnings[0]
              ? body.warnings[0]
              : undefined;
          equipmentOnlyAlert?.showEquipmentOnlyWarning(detail);
        } else {
          equipmentOnlyAlert?.clearEquipmentOnlyWarning();
        }

        if (Array.isArray(body.warnings) && body.warnings.length > 0) {
          setInventoryWarnings(body.warnings);
        } else {
          setInventoryWarnings([]);
        }

        if (body.syncedAt) {
          latestSyncedAtRef.current = body.syncedAt;
        }

        if (!body.cached) {
          router.refresh();
        }

        return latestSyncedAtRef.current;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Inventory refresh failed";
        setInventoryError(msg);
        toast.error(msg, manifestToastDefaults);
        return latestSyncedAtRef.current;
      } finally {
        setPhase("idle");
      }
    },
    [
      equipmentOnlyAlert,
      handleReauth,
      router,
      setInventoryError,
      setInventoryWarnings,
      setPhase,
    ],
  );

  const runPipeline = useCallback(
    async (opts?: { forceManifest?: boolean; forceInventory?: boolean }) => {
      if (inFlightRef.current) return;
      const gen = ++generationRef.current;
      inFlightRef.current = true;
      try {
        setReauthMessage(null);

        const needsManifest =
          health.manifestNeedsSync || opts?.forceManifest === true;
        if (needsManifest) {
          let ok = await runManifestSync(opts?.forceManifest === true);
          if (gen !== generationRef.current) return;
          if (!ok && !opts?.forceManifest) {
            ok = await runManifestSync(true);
          }
          if (gen !== generationRef.current) return;
          if (!ok) return;
        }

        const needsInventory =
          opts?.forceInventory === true ||
          inventoryCacheNeedsSync(latestSyncedAtRef.current) ||
          needsManifest;
        if (needsInventory) {
          await runInventorySync(opts?.forceInventory === true);
        }
      } finally {
        inFlightRef.current = false;
      }
    },
    [health.manifestNeedsSync, runInventorySync, runManifestSync, setReauthMessage],
  );

  const scheduleResyncRef = useRef<(fromSyncedAt: string | null) => void>(
    () => {},
  );

  const scheduleResync = useCallback(
    (fromSyncedAt: string | null) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const delay = inventoryMsUntilResync(fromSyncedAt);
      timerRef.current = setTimeout(() => {
        void runPipeline().then(() => {
          scheduleResyncRef.current(latestSyncedAtRef.current);
        });
      }, delay);
    },
    [runPipeline],
  );

  useEffect(() => {
    scheduleResyncRef.current = scheduleResync;
  }, [scheduleResync]);

  useEffect(() => {
    registerRetry(() => {
      void runPipeline({ forceManifest: true, forceInventory: true });
    });
    return () => registerRetry(null);
  }, [registerRetry, runPipeline]);

  useEffect(() => {
    const syncedAt = health.inventorySyncedAt;
    const shouldRun =
      health.manifestNeedsSync ||
      inventoryCacheNeedsSync(syncedAt) ||
      !health.hasInventoryCache;

    if (shouldRun) {
      void runPipeline().then(() => {
        scheduleResync(latestSyncedAtRef.current ?? syncedAt);
      });
    } else {
      scheduleResync(syncedAt);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    health.hasInventoryCache,
    health.inventorySyncedAt,
    health.manifestNeedsSync,
    runPipeline,
    scheduleResync,
  ]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      const syncedAt = latestSyncedAtRef.current;
      if (
        !inventoryCacheNeedsSync(syncedAt) &&
        !manifestNeedsSyncRef.current
      ) {
        return;
      }
      void runPipeline().then(() => {
        scheduleResync(latestSyncedAtRef.current);
      });
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [runPipeline, scheduleResync]);

  return null;
}
