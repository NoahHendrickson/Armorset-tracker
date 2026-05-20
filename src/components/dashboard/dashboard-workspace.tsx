"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";
import { useGridFiltersPersistence } from "@/lib/workspace/use-grid-filters-persistence";
import type { TrackerFormSelectors } from "@/components/workspace/new-tracker-dialog";
import { AppHeader } from "@/components/app-header";
import { GridWorkspace } from "@/components/workspace/grid-workspace";
import { InventoryTableView } from "@/components/dashboard/inventory-table-view";
import {
  WorkspaceViewModeTabs,
  type WorkspaceViewMode,
} from "@/components/dashboard/workspace-view-mode-tabs";

export interface DashboardWorkspaceProps {
  displayName: string;
  profilePictureUrl: string | null;
  banners: ReactNode;
  syncWarning: string | null;
  hasInventory: boolean;
  selectors: TrackerFormSelectors;
  inventory: DerivedArmorPieceJson[];
  lookupPayload: GridLookupPayload;
  initialGridFilters: GridFiltersJson;
  appliedFromShare?: boolean;
  invalidShareLink?: boolean;
}

export function DashboardWorkspace({
  displayName,
  profilePictureUrl,
  banners,
  syncWarning,
  hasInventory,
  selectors,
  inventory,
  lookupPayload,
  initialGridFilters,
  appliedFromShare = false,
  invalidShareLink = false,
}: DashboardWorkspaceProps) {
  const [mode, setMode] = useState<WorkspaceViewMode>("grid");
  const tabs = <WorkspaceViewModeTabs mode={mode} onModeChange={setMode} />;
  const { filters, onFiltersChange } =
    useGridFiltersPersistence(initialGridFilters);
  const shareHandledRef = useRef(false);

  useEffect(() => {
    if (shareHandledRef.current) return;
    if (invalidShareLink) {
      shareHandledRef.current = true;
      toast.warning("This share link is invalid or out of date.");
      return;
    }
    if (!appliedFromShare) return;
    shareHandledRef.current = true;
    onFiltersChange(initialGridFilters);
    toast.success("Shared filters applied to your inventory.");
  }, [
    appliedFromShare,
    invalidShareLink,
    initialGridFilters,
    onFiltersChange,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppHeader
        displayName={displayName}
        profilePictureUrl={profilePictureUrl}
        leadingAccessory={tabs}
      />
      {mode === "table" ? (
        <InventoryTableView
          banners={banners}
          syncWarning={syncWarning}
          hasInventory={hasInventory}
          inventory={inventory}
          selectors={selectors}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
      ) : (
        <GridWorkspace
          banners={banners}
          syncWarning={syncWarning}
          hasInventory={hasInventory}
          selectors={selectors}
          inventory={inventory}
          lookupPayload={lookupPayload}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
      )}
    </div>
  );
}
