"use client";

import { useMemo } from "react";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewViewForm } from "@/components/views/new-view-form";
import type { TrackerOptionItem } from "@/lib/views/tracker-option";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import { centeredTrackerLayout } from "@/lib/workspace/workspace-schema";

export interface TrackerFormSelectors {
  setsByClass: { 0: TrackerOptionItem[]; 1: TrackerOptionItem[]; 2: TrackerOptionItem[] };
  archetypes: TrackerOptionItem[];
  tunings: TrackerOptionItem[];
  manifestEmpty: boolean;
}

interface NewTrackerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackers: SerializableTrackerPayload[];
  selectors: TrackerFormSelectors;
  onCreated: () => void;
}

export function NewTrackerDialog({
  open,
  onOpenChange,
  trackers,
  selectors,
  onCreated,
}: NewTrackerDialogProps) {
  const initialLayout = useMemo(() => {
    const maxZ = trackers.length
      ? Math.max(...trackers.map((t) => t.view.layout.z))
      : -1;
    return centeredTrackerLayout(maxZ + 1);
  }, [trackers]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New tracker</DialogTitle>
          <DialogDescription>
            Pick class, armor set, archetype, and tuning — then arrange it on the canvas.
          </DialogDescription>
        </DialogHeader>

        {selectors.manifestEmpty ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
          >
            <Warning weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="space-y-1">
              <p className="font-medium">Manifest not synced</p>
              <p className="text-muted-foreground">
                Selectors stay empty until a manifest sync completes.
              </p>
            </div>
          </div>
        ) : null}

        <NewViewForm
            setsByClass={selectors.setsByClass}
            archetypes={selectors.archetypes}
            tunings={selectors.tunings}
            embedded
            initialLayout={initialLayout}
            onCancel={() => onOpenChange(false)}
            onCreated={() => {
              onCreated();
              onOpenChange(false);
            }}
          />
      </DialogContent>
    </Dialog>
  );
}
