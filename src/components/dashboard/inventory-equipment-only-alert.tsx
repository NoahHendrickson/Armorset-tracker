"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Warning, X } from "@phosphor-icons/react/dist/ssr";
import { BUNGIE_RECONNECT_PATH } from "@/lib/auth/bungie-reauth";
import { INVENTORY_EQUIPMENT_ONLY_WARNING } from "@/lib/inventory/user-messages";
import { Button } from "@/components/ui/button";

interface InventoryEquipmentOnlyContextValue {
  warning: string | null;
  showEquipmentOnlyWarning: (detail?: string) => void;
  clearEquipmentOnlyWarning: () => void;
}

const InventoryEquipmentOnlyContext =
  createContext<InventoryEquipmentOnlyContextValue | null>(null);

export function InventoryEquipmentOnlyProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [warning, setWarning] = useState<string | null>(null);

  const showEquipmentOnlyWarning = useCallback((detail?: string) => {
    setWarning(detail?.trim() || INVENTORY_EQUIPMENT_ONLY_WARNING);
  }, []);

  const clearEquipmentOnlyWarning = useCallback(() => {
    setWarning(null);
  }, []);

  const value = useMemo(
    () => ({
      warning,
      showEquipmentOnlyWarning,
      clearEquipmentOnlyWarning,
    }),
    [warning, showEquipmentOnlyWarning, clearEquipmentOnlyWarning],
  );

  return (
    <InventoryEquipmentOnlyContext.Provider value={value}>
      {children}
    </InventoryEquipmentOnlyContext.Provider>
  );
}

export function useInventoryEquipmentOnlyAlert() {
  return useContext(InventoryEquipmentOnlyContext);
}

export function InventoryEquipmentOnlyBanner() {
  const ctx = useInventoryEquipmentOnlyAlert();
  if (!ctx?.warning) return null;

  return (
    <div
      role="alert"
      className="flex shrink-0 flex-col gap-3 border-b border-destructive/50 bg-destructive/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4 sm:px-6"
    >
      <Warning
        weight="duotone"
        className="size-5 shrink-0 text-destructive"
        aria-hidden
      />
      <p className="min-w-0 flex-1 leading-snug text-destructive">
        {ctx.warning}
      </p>
      <div className="flex shrink-0 items-center gap-2 sm:ms-auto">
        <Button
          type="button"
          variant="default"
          size="sm"
          className="rounded-none"
          onClick={() => {
            window.location.href = BUNGIE_RECONNECT_PATH;
          }}
        >
          Reconnect Bungie
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 rounded-none text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label="Dismiss alert"
          onClick={ctx.clearEquipmentOnlyWarning}
        >
          <X weight="bold" className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
