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
import { useInventoryEquipmentOnlyAlert } from "@/components/dashboard/inventory-equipment-only-alert";

interface InventoryAutoSyncProps {
  /** Last server-side cache timestamp; null if never synced. */
  inventorySyncedAt: string | null;
}

type SyncResponse = {
  error?: string;
  code?: string;
  reconnectPath?: string;
  syncedAt?: string;
  itemCount?: number;
  warnings?: string[];
  equipmentOnlyRestricted?: boolean;
  cached?: boolean;
};

/**
 * Background inventory refresh: sync immediately when stale, then on a TTL
 * schedule and when the tab regains focus after being away.
 */
export function InventoryAutoSync({
  inventorySyncedAt,
}: InventoryAutoSyncProps) {
  const router = useRouter();
  const equipmentOnlyAlert = useInventoryEquipmentOnlyAlert();
  const inFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSyncedAtRef = useRef(inventorySyncedAt);

  useEffect(() => {
    latestSyncedAtRef.current = inventorySyncedAt;
  }, [inventorySyncedAt]);

  const runSync = useCallback(async (): Promise<string | null> => {
    if (inFlightRef.current) return latestSyncedAtRef.current;
    inFlightRef.current = true;
    try {
      const res = await fetch("/api/inventory/sync", {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json()) as SyncResponse;

      if (!res.ok) {
        if (body.code === BUNGIE_REAUTH_REQUIRED_CODE) {
          toast.error(body.error ?? BUNGIE_REAUTH_USER_MESSAGE, {
            duration: 22_000,
            action: {
              label: "Reconnect Bungie",
              onClick: () => {
                window.location.href =
                  body.reconnectPath ?? BUNGIE_RECONNECT_PATH;
              },
            },
          });
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

      if (body.syncedAt) {
        latestSyncedAtRef.current = body.syncedAt;
      }

      if (!body.cached) {
        router.refresh();
      }

      return latestSyncedAtRef.current;
    } catch {
      // Manual refresh remains available from the header.
      return latestSyncedAtRef.current;
    } finally {
      inFlightRef.current = false;
    }
  }, [equipmentOnlyAlert, router]);

  const scheduleResync = useCallback(
    (fromSyncedAt: string | null) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const delay = inventoryMsUntilResync(fromSyncedAt);
      timerRef.current = setTimeout(() => {
        void runSync().then((nextSyncedAt) => {
          scheduleResync(nextSyncedAt);
        });
      }, delay);
    },
    [runSync],
  );

  useEffect(() => {
    const syncedAt = inventorySyncedAt;
    if (inventoryCacheNeedsSync(syncedAt)) {
      void runSync().then((nextSyncedAt) => {
        scheduleResync(nextSyncedAt ?? syncedAt);
      });
    } else {
      scheduleResync(syncedAt);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [inventorySyncedAt, runSync, scheduleResync]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      const syncedAt = latestSyncedAtRef.current;
      if (!inventoryCacheNeedsSync(syncedAt)) return;
      void runSync().then((nextSyncedAt) => {
        scheduleResync(nextSyncedAt);
      });
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [runSync, scheduleResync]);

  return null;
}
