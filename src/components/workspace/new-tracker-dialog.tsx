"use client";

import { useCallback, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Plus, Warning, X } from "@phosphor-icons/react/dist/ssr";
import { NewViewForm } from "@/components/views/new-view-form";
import {
  Popover,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
} from "@/components/ui/popover";
import type { TrackerOptionItem } from "@/lib/views/tracker-option";
import { layoutForNewTrackerAvoidingOverlap } from "@/lib/workspace/workspace-schema";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";

const WORKSPACE_NEW_TRACKER_FORM_ID = "workspace-new-tracker-form";

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
  onCreated: (tracker?: SerializableTrackerPayload) => void;
  /**
   * Canvas-space top-left seed (viewport-centered when implemented). If omitted
   * or null, placement uses workspace geometric center.
   */
  getPreferredTrackerTopLeft?: () => { x: number; y: number } | null;
}

const FAB_CLASSES =
  "relative flex h-12 shrink-0 items-center gap-2 overflow-hidden rounded-none bg-[#07ad6b] px-6 text-sm font-medium text-white transition-colors hover:bg-[#0ac07a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07ad6b] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60";

function isFromFabShell(shell: HTMLDivElement | null, target: EventTarget | null) {
  return Boolean(shell && target instanceof Node && shell.contains(target));
}

const FAB_SHADOW: CSSProperties = {
  boxShadow:
    "0 10px 20px -5px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.24), inset 0 -10px 14px -4px rgba(255,255,255,0.16)",
};

export function NewTrackerDialog({
  open,
  onOpenChange,
  trackers,
  selectors,
  onCreated,
  getPreferredTrackerTopLeft,
}: NewTrackerDialogProps) {
  const fabShellRef = useRef<HTMLDivElement>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [canSubmitForm, setCanSubmitForm] = useState(false);

  const resolveLayoutOnSubmit = useCallback(() => {
    const maxZ = trackers.length
      ? Math.max(...trackers.map((t) => t.view.layout.z))
      : -1;
    const existingRects = trackers.map((t) => ({
      x: t.view.layout.x,
      y: t.view.layout.y,
      w: t.view.layout.w,
      h: t.view.layout.h,
    }));
    const preferred = getPreferredTrackerTopLeft?.() ?? null;
    return layoutForNewTrackerAvoidingOverlap(maxZ + 1, existingRects, {
      preferredTopLeft: preferred ?? undefined,
    });
  }, [trackers, getPreferredTrackerTopLeft]);

  const label = submitBusy ? "Saving..." : open ? "Create" : "New tracker";
  const aria = open ? "Create tracker (submit)" : "New tracker";
  const showCreateReadyRing =
    open && canSubmitForm && !submitBusy && !selectors.manifestEmpty;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) setCanSubmitForm(false);
        onOpenChange(next);
      }}
    >
      <div ref={fabShellRef} className="relative inline-flex shrink-0 overflow-visible">
        {showCreateReadyRing ? (
          <>
            <span className="new-tracker-create-ring rounded-none" aria-hidden />
            <span
              className="new-tracker-create-ring new-tracker-create-ring--delayed rounded-none"
              aria-hidden
            />
          </>
        ) : null}
        <PopoverAnchor asChild>
          <button
            disabled={selectors.manifestEmpty || submitBusy}
            type={open ? "submit" : "button"}
            form={open ? WORKSPACE_NEW_TRACKER_FORM_ID : undefined}
            onClick={(e) => {
              if (!open && !selectors.manifestEmpty) {
                e.preventDefault();
                onOpenChange(true);
              }
            }}
            className={`pointer-events-auto z-[1] ${FAB_CLASSES}`}
            style={FAB_SHADOW}
            aria-expanded={open}
            aria-busy={submitBusy || undefined}
            aria-haspopup="dialog"
            aria-label={aria}
          >
            {!open ? <Plus className="h-5 w-5" weight="duotone" /> : null}
            <span>{label}</span>
          </button>
        </PopoverAnchor>
      </div>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={10}
        collisionPadding={16}
        className="max-w-lg border-[#424347] bg-[#2d2e32] p-8 text-white shadow-xl [&_.text-muted-foreground]:text-white/65"
        onPointerDownOutside={(e) => {
          const target = e.detail.originalEvent.target;
          if (isFromFabShell(fabShellRef.current, target)) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isFromFabShell(fabShellRef.current, e.target ?? null)) e.preventDefault();
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1 pr-2">
            <h2 className="text-lg font-semibold leading-none tracking-tight">New tracker</h2>
            <p className="text-sm text-muted-foreground">
              Choose class, armor set, archetype, and tuning — then arrange it on the canvas.
            </p>
          </div>
          <PopoverClose
            type="button"
            className="shrink-0 rounded-none p-1.5 text-white/70 opacity-90 ring-offset-[#2d2e32] transition-opacity hover:bg-white/10 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#2d2e32]"
            aria-label="Close"
          >
            <X weight="duotone" className="h-4 w-4" />
          </PopoverClose>
        </div>

        {selectors.manifestEmpty ? (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 rounded-none border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
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
          formId={WORKSPACE_NEW_TRACKER_FORM_ID}
          externalSubmit
          resolveLayoutOnSubmit={resolveLayoutOnSubmit}
          onBusyChange={setSubmitBusy}
          onCanSubmitChange={setCanSubmitForm}
          onCancel={() => onOpenChange(false)}
          onCreated={(_viewId, tracker) => {
            onCreated(tracker);
            onOpenChange(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
