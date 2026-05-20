"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import type { DerivedArmorPieceJson, SavedFilterViewRow } from "@/lib/db/types";
import type { GridLookupPayload } from "@/lib/views/grid-lookup-payload";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";
import { useGridFiltersPersistence } from "@/lib/workspace/use-grid-filters-persistence";
import {
  applyPayloadToGridFilters,
  parseSavedFilterViewPayload,
  savedViewPayloadMatchesFilters,
} from "@/lib/saved-views/schema";
import type { TrackerFormSelectors } from "@/components/workspace/new-tracker-dialog";
import { AppHeader } from "@/components/app-header";
import { GridWorkspace } from "@/components/workspace/grid-workspace";
import { InventoryTableView } from "@/components/dashboard/inventory-table-view";
import {
  WorkspaceViewModeTabs,
  type WorkspaceViewMode,
} from "@/components/dashboard/workspace-view-mode-tabs";
import { SavedViewsMenu } from "@/components/workspace/saved-views-menu";

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
  hasInventory,
  selectors,
  inventory,
  lookupPayload,
  initialGridFilters,
  initialSavedViews,
  appliedFromShare = false,
  invalidShareLink = false,
  savedViewImportedId = null,
}: DashboardWorkspaceProps) {
  const [mode, setMode] = useState<WorkspaceViewMode>("grid");
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

  const savedViewsSlot = (
    <SavedViewsMenu
      views={savedViews}
      activeViewId={activeSavedViewId}
      filters={filters}
      onViewsChange={setSavedViews}
      onApply={applySavedView}
    />
  );

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
          savedViewsSlot={savedViewsSlot}
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
          savedViewsSlot={savedViewsSlot}
        />
      )}
    </div>
  );
}
