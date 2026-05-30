"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BUNGIE_REAUTH_REQUIRED_CODE,
  BUNGIE_RECONNECT_PATH,
  BUNGIE_REAUTH_USER_MESSAGE,
} from "@/lib/auth/bungie-reauth";
import { useInventoryEquipmentOnlyAlert } from "@/components/dashboard/inventory-equipment-only-alert";

interface InventoryAutoSyncProps {
  /** When true, POST /api/inventory/sync once on mount (non-forced). */
  enabled: boolean;
}

/**
 * Background inventory refresh so the dashboard can render from cache immediately
 * instead of blocking SSR on Bungie GetProfile.
 */
export function InventoryAutoSync({ enabled }: InventoryAutoSyncProps) {
  const router = useRouter();
  const startedRef = useRef(false);
  const equipmentOnlyAlert = useInventoryEquipmentOnlyAlert();

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/inventory/sync", {
          method: "POST",
          credentials: "include",
        });
        const body = (await res.json()) as {
          error?: string;
          code?: string;
          reconnectPath?: string;
          itemCount?: number;
          warnings?: string[];
          equipmentOnlyRestricted?: boolean;
          cached?: boolean;
        };

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
          return;
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

        if (!body.cached) {
          router.refresh();
        }
      } catch {
        // Manual refresh remains available from the header.
      }
    })();
  }, [enabled, router, equipmentOnlyAlert]);

  return null;
}
