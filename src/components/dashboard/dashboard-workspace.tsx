"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import type { DerivedArmorPieceJson, SavedFilterViewRow } from "@/lib/db/types";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import type { OptimizerLookupPayload } from "@/lib/views/optimizer-lookup-payload";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";
import { useGridFiltersPersistence } from "@/lib/workspace/use-grid-filters-persistence";
import {
  applyPayloadToGridFilters,
  parseSavedFilterViewPayload,
  savedViewPayloadMatchesFilters,
} from "@/lib/saved-views/schema";
import type { TrackerFormSelectors } from "@/lib/views/tracker-form-selectors";
import { AppHeader } from "@/components/app-header";
import { GridWorkspace } from "@/components/workspace/grid-workspace";
import { InventoryTableView } from "@/components/dashboard/inventory-table-view";
import { LoadoutOptimizerView } from "@/components/dashboard/loadout-optimizer-view";
import {
  WorkspaceViewModeTabs,
  type WorkspaceViewMode,
} from "@/components/dashboard/workspace-view-mode-tabs";
import { WorkspaceAutoSync } from "@/components/dashboard/workspace-auto-sync";
import { WorkspaceSyncProvider } from "@/components/dashboard/workspace-sync-status";
import type { WorkspaceDataHealth } from "@/lib/workspace/workspace-data-health.shared";
import {
  InventoryEquipmentOnlyBanner,
  InventoryEquipmentOnlyProvider,
} from "@/components/dashboard/inventory-equipment-only-alert";

export interface DashboardWorkspaceProps {
  displayName: string;
  profilePictureUrl: string | null;
  banners: ReactNode;
  syncWarning: string | null;
  dataHealth: WorkspaceDataHealth;
  hasInventory: boolean;
  selectors: TrackerFormSelectors;
  inventory: DerivedArmorPieceJson[];
  lookupPayload: GridLookupPayload;
  optimizerLookup: OptimizerLookupPayload;
  initialGridFilters: GridFiltersJson;
  initialSavedViews: SavedFilterViewRow[];
  appliedFromShare?: boolean;
  invalidShareLink?: boolean;
  savedViewImportedId?: string | null;
}

export function DashboardWorkspace({
  displayName,
  profilePictureUrl,
  banners,
  syncWarning,
  dataHealth,
  hasInventory,
  selectors,
  inventory,
  lookupPayload,
  optimizerLookup,
  initialGridFilters,
  initialSavedViews,
  appliedFromShare = false,
  invalidShareLink = false,
  savedViewImportedId = null,
}: DashboardWorkspaceProps) {
  const [mode, setMode] = useState<WorkspaceViewMode>("table");
  const [savedViews, setSavedViews] =
    useState<SavedFilterViewRow[]>(initialSavedViews);
  const tabs = <WorkspaceViewModeTabs mode={mode} onModeChange={setMode} />;
  const { filters, onFiltersChange } =
    useGridFiltersPersistence(initialGridFilters);
  const shareHandledRef = useRef(false);
  const importHandledRef = useRef(false);

  const activeSavedViewId = useMemo(() => {
    for (const view of savedViews) {
      const payload = parseSavedFilterViewPayload(view.filters);
      if (!payload) continue;
      if (savedViewPayloadMatchesFilters(filters, payload)) {
        return view.id;
      }
    }
    return null;
  }, [filters, savedViews]);

  const applySavedView = useCallback(
    (view: SavedFilterViewRow) => {
      const payload = parseSavedFilterViewPayload(view.filters);
      if (!payload) {
        toast.error("This view has invalid saved data.");
        return;
      }
      onFiltersChange(applyPayloadToGridFilters(filters, payload));
    },
    [filters, onFiltersChange],
  );

  const clearActiveSavedView = useCallback(() => {
    onFiltersChange({
      ...filters,
      setHashes: [],
      archetypeHashes: [],
      tuningHashes: [],
      tertiaryStats: [],
    });
  }, [filters, onFiltersChange]);

  const savedViewsMenuProps = {
    views: savedViews,
    activeViewId: activeSavedViewId,
    filters,
    onViewsChange: setSavedViews,
    onApply: applySavedView,
    onClearActive: clearActiveSavedView,
  };

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

  useEffect(() => {
    if (importHandledRef.current || !savedViewImportedId) return;
    importHandledRef.current = true;
    const imported = savedViews.find((v) => v.id === savedViewImportedId);
    if (!imported) {
      toast.warning("Could not apply the shared view.");
      return;
    }
    applySavedView(imported);
    const fromName = imported.source_display_name?.trim();
    toast.success(
      fromName
        ? `Shared view applied — from ${fromName}.`
        : "Shared view applied to your filters.",
    );
  }, [applySavedView, savedViewImportedId, savedViews]);

  return (
    <InventoryEquipmentOnlyProvider>
      <WorkspaceSyncProvider health={dataHealth}>
        <div className="flex h-full min-h-0 flex-col">
          <WorkspaceAutoSync />
          <InventoryEquipmentOnlyBanner />
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
            savedViews={savedViewsMenuProps}
          />
        ) : mode === "grid" ? (
          <GridWorkspace
            banners={banners}
            syncWarning={syncWarning}
            hasInventory={hasInventory}
            selectors={selectors}
            inventory={inventory}
            lookupPayload={lookupPayload}
            filters={filters}
            onFiltersChange={onFiltersChange}
            savedViews={savedViewsMenuProps}
          />
        ) : (
          <LoadoutOptimizerView
            banners={banners}
            syncWarning={syncWarning}
            hasInventory={hasInventory}
            inventory={inventory}
            filters={filters}
            onFiltersChange={onFiltersChange}
            optimizerLookup={optimizerLookup}
            statIconByName={lookupPayload.statIconByName}
          />
        )}
        </div>
      </WorkspaceSyncProvider>
    </InventoryEquipmentOnlyProvider>
  );
}
