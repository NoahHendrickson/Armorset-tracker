"use client";

import { CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import type { InventoryTableEmptyState } from "@/lib/workspace/workspace-data-health.shared";
import { Button } from "@/components/ui/button";
import { BUNGIE_RECONNECT_PATH } from "@/lib/auth/bungie-reauth";

export function WorkspaceSyncGatePanel({
  state,
  onRetry,
}: {
  state: InventoryTableEmptyState;
  onRetry: () => void;
}) {
  const isLoading =
    state.kind === "syncing-manifest" || state.kind === "syncing-inventory";

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center"
      role={isLoading ? "status" : "alert"}
    >
      {isLoading ? (
        <CircleNotch
          weight="duotone"
          className="h-8 w-8 animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : null}
      <div className="max-w-md space-y-2">
        <p className="text-base font-medium text-foreground">{state.title}</p>
        <p className="text-sm text-muted-foreground">{state.detail}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {state.kind === "reauth" ? (
          <Button asChild size="sm">
            <a href={BUNGIE_RECONNECT_PATH}>Reconnect Bungie</a>
          </Button>
        ) : null}
        {state.kind === "inventory-error" ||
        state.kind === "syncing-inventory" ||
        state.kind === "empty-inventory" ? (
          <RefreshButton variant="button" />
        ) : null}
        {state.kind === "manifest-error" ||
        state.kind === "inventory-error" ||
        state.kind === "manifest-not-ready" ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry sync
          </Button>
        ) : null}
      </div>
    </div>
  );
}
