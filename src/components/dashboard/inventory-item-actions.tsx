"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  BUNGIE_REAUTH_REQUIRED_CODE,
  BUNGIE_RECONNECT_PATH,
} from "@/lib/auth/bungie-reauth";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import {
  equipDisabledMessage,
  moveDisabledMessage,
} from "@/lib/inventory/equip-plan";
import type { InventoryItemActionResponse } from "@/lib/inventory/item-action-contract";
import type { GridFilterClass } from "@/lib/workspace/grid-filters-schema";
import { Button } from "@/components/ui/button";
import { INLINE_TRIGGER_SUCCESS_FLASH_CLASS } from "@/components/workspace/filter-bar-primitives";
import { cn } from "@/lib/utils";

const SUCCESS_FLASH_MS = 3000;

const EQUIP_GAMEPLAY_HINT =
  "Destiny must be in orbit, a social space, or offline.";

function ActionSuccessLabel({ children }: { children: string }) {
  return (
    <>
      <Check weight="bold" className="size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </>
  );
}

interface InventoryItemActionsProps {
  piece: DerivedArmorPieceJson;
  targetClass: GridFilterClass;
}

async function postInventoryAction(
  path: "/api/inventory/move" | "/api/inventory/equip",
  piece: DerivedArmorPieceJson,
  targetClass: GridFilterClass,
): Promise<InventoryItemActionResponse & { ok?: boolean; refresh?: boolean }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      itemInstanceId: piece.itemInstanceId,
      itemHash: piece.itemHash,
      classType: targetClass,
    }),
  });
  const data = (await res.json()) as InventoryItemActionResponse;
  if (!res.ok) {
    if (data.code === BUNGIE_REAUTH_REQUIRED_CODE) {
      toast.error(data.error ?? "Reconnect Bungie", {
        action: {
          label: "Sign in",
          onClick: () => {
            window.location.href = BUNGIE_RECONNECT_PATH;
          },
        },
      });
      return data;
    }
    if (data.partial) {
      toast.warning(data.error ?? "Action partially completed");
      return { ...data, refresh: true };
    }
    throw new Error(data.error ?? "Request failed");
  }
  return { ...data, ok: true };
}

export function InventoryItemActions({
  piece,
  targetClass,
}: InventoryItemActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<"move" | "equip" | null>(null);
  const [successFlash, setSuccessFlash] = useState<"move" | "equip" | null>(
    null,
  );

  useEffect(() => {
    if (!successFlash) return;
    const id = window.setTimeout(() => {
      setSuccessFlash(null);
      startTransition(() => router.refresh());
    }, SUCCESS_FLASH_MS);
    return () => clearTimeout(id);
  }, [successFlash, router]);

  const moveReason = moveDisabledMessage(piece, targetClass);
  const equipReason = equipDisabledMessage(piece, targetClass);
  const moveDisabled =
    Boolean(moveReason) || pending || busyAction !== null;
  const equipDisabled =
    Boolean(equipReason) || pending || busyAction !== null;

  async function runAction(
    action: "move" | "equip",
    path: "/api/inventory/move" | "/api/inventory/equip",
    disabled: boolean,
    failureMessage: string,
  ) {
    if (disabled || successFlash === action) return;
    setBusyAction(action);
    try {
      const data = await postInventoryAction(path, piece, targetClass);
      if (data.ok) {
        setSuccessFlash(action);
      } else if (data.refresh) {
        startTransition(() => router.refresh());
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failureMessage);
    } finally {
      setBusyAction(null);
    }
  }

  const moveSucceeded = successFlash === "move";
  const equipSucceeded = successFlash === "equip";

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "h-7 shrink-0 rounded-none px-2 text-xs",
          moveSucceeded && INLINE_TRIGGER_SUCCESS_FLASH_CLASS,
          moveSucceeded && "pointer-events-none",
        )}
        disabled={moveDisabled}
        aria-disabled={moveDisabled || moveSucceeded}
        title={moveReason ?? undefined}
        onClick={() =>
          void runAction("move", "/api/inventory/move", moveDisabled, "Could not move armor")
        }
      >
        {busyAction === "move" ? (
          "Moving…"
        ) : moveSucceeded ? (
          <ActionSuccessLabel>Moved</ActionSuccessLabel>
        ) : (
          "Move to character"
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "h-7 shrink-0 rounded-none px-2 text-xs",
          equipSucceeded && INLINE_TRIGGER_SUCCESS_FLASH_CLASS,
          equipSucceeded && "pointer-events-none",
        )}
        disabled={equipDisabled}
        aria-disabled={equipDisabled || equipSucceeded}
        title={
          equipReason ?? (!equipDisabled ? EQUIP_GAMEPLAY_HINT : undefined)
        }
        onClick={() =>
          void runAction(
            "equip",
            "/api/inventory/equip",
            equipDisabled,
            "Could not equip armor",
          )
        }
      >
        {busyAction === "equip" ? (
          "Equipping…"
        ) : equipSucceeded ? (
          <ActionSuccessLabel>Equipped</ActionSuccessLabel>
        ) : (
          "Equip"
        )}
      </Button>
    </div>
  );
}
