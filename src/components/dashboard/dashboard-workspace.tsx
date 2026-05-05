"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { DerivedArmorPieceJson } from "@/lib/db/types";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import type { WorkspaceCameraJson } from "@/lib/workspace/workspace-schema";
import type { TrackerFormSelectors } from "@/components/workspace/new-tracker-dialog";
import { AppHeader } from "@/components/app-header";
import { CanvasWorkspace } from "@/components/workspace/canvas-workspace";
import { InventoryTableView } from "@/components/dashboard/inventory-table-view";
import {
  WorkspaceViewModeTabs,
  type WorkspaceViewMode,
} from "@/components/dashboard/workspace-view-mode-tabs";

export interface DashboardWorkspaceProps {
  displayName: string;
  profilePictureUrl: string | null;
  banners: ReactNode;
  initialTrackers: SerializableTrackerPayload[];
  initialCamera: WorkspaceCameraJson;
  focusTrackerId: string | null;
  syncWarning: string | null;
  hasInventory: boolean;
  selectors: TrackerFormSelectors;
  inventory: DerivedArmorPieceJson[];
}

export function DashboardWorkspace({
  displayName,
  profilePictureUrl,
  banners,
  initialTrackers,
  initialCamera,
  focusTrackerId,
  syncWarning,
  hasInventory,
  selectors,
  inventory,
}: DashboardWorkspaceProps) {
  const [mode, setMode] = useState<WorkspaceViewMode>("canvas");
  const tabs = <WorkspaceViewModeTabs mode={mode} onModeChange={setMode} />;

  return (
    <>
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
        />
      ) : (
        <CanvasWorkspace
          banners={banners}
          initialTrackers={initialTrackers}
          initialCamera={initialCamera}
          focusTrackerId={focusTrackerId}
          syncWarning={syncWarning}
          hasInventory={hasInventory}
          selectors={selectors}
        />
      )}
    </>
  );
}
