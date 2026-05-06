"use client";

import { useCallback, useRef, useState } from "react";
import { Warning } from "@phosphor-icons/react/dist/ssr";
import {
  NewViewForm,
  type NewTrackerLayoutDraft,
  type NewViewFormHandle,
} from "@/components/views/new-view-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TrackerFormSelectors } from "@/components/workspace/new-tracker-dialog";
import type { WorkspaceLayoutJson } from "@/lib/workspace/workspace-schema";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";

const WORKSPACE_DUPLICATE_TRACKER_FORM_ID = "workspace-duplicate-tracker-form";

interface DuplicateTrackerDialogProps {
  source: SerializableTrackerPayload | null;
  onOpenChange: (open: boolean) => void;
  selectors: TrackerFormSelectors;
  onCreated: (tracker?: SerializableTrackerPayload) => void;
  resolveLayoutOnSubmit?: (draft: NewTrackerLayoutDraft) => WorkspaceLayoutJson;
}

export function DuplicateTrackerDialog({
  source,
  onOpenChange,
  selectors,
  onCreated,
  resolveLayoutOnSubmit,
}: DuplicateTrackerDialogProps) {
  const formRef = useRef<NewViewFormHandle>(null);
  const [armorSetComboboxPortalContainer, setArmorSetComboboxPortalContainer] =
    useState<HTMLElement | null>(null);
  const dialogContentRef = useCallback((node: HTMLElement | null) => {
    setArmorSetComboboxPortalContainer(node);
  }, []);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [canSubmitForm, setCanSubmitForm] = useState(false);
  const [fieldsComplete, setFieldsComplete] = useState(false);

  const open = source !== null;
  const showUnchangedBlockedLayer =
    fieldsComplete && !canSubmitForm && !submitBusy && !selectors.manifestEmpty;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setCanSubmitForm(false);
          setFieldsComplete(false);
          onOpenChange(false);
        }
      }}
    >
      <DialogContent
        ref={dialogContentRef}
        className="max-h-[min(90vh,44rem)] max-w-lg overflow-y-auto rounded-none border-[#424347] bg-[#2d2e32] p-8 text-white shadow-xl sm:rounded-none [&_.text-muted-foreground]:text-white/65"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {source ?
          <>
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-lg font-semibold text-white">
                Duplicate tracker
              </DialogTitle>
              <DialogDescription className="text-sm text-white/65">
                Adjust anything that should differ from your current tracker&apos;s
                build, then create the new tracker on your canvas.
              </DialogDescription>
            </DialogHeader>

            {selectors.manifestEmpty ?
              <div
                role="alert"
                className="flex items-start gap-3 rounded-none border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
              >
                <Warning
                  weight="duotone"
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                />
                <div className="space-y-1">
                  <p className="font-medium">Manifest not synced</p>
                  <p className="text-muted-foreground">
                    Selectors stay empty until a manifest sync completes.
                  </p>
                </div>
              </div>
            : null}

            <NewViewForm
              ref={formRef}
              key={source.view.id}
              armorSetComboboxPortalContainer={armorSetComboboxPortalContainer}
              setsByClass={selectors.setsByClass}
              archetypes={selectors.archetypes}
              tunings={selectors.tunings}
              embedded
              formId={WORKSPACE_DUPLICATE_TRACKER_FORM_ID}
              externalSubmit
              suppressEmbeddedActionRow
              resolveLayoutOnSubmit={resolveLayoutOnSubmit}
              prefillFrom={{
                classType: source.view.class_type,
                setHash: source.view.set_hash,
                archetypeHash: source.view.archetype_hash,
                tuningHash: source.view.tuning_hash,
              }}
              requireChangeFromPrefill
              onBusyChange={setSubmitBusy}
              onCanSubmitChange={setCanSubmitForm}
              onFieldsCompleteChange={setFieldsComplete}
              onCreated={(_viewId, tracker) => {
                onCreated(tracker);
                onOpenChange(false);
              }}
            />

            <DialogFooter className="w-full gap-2 sm:items-center sm:justify-start sm:gap-2 sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                className="h-9 w-fit shrink-0 self-start rounded-none"
                onClick={() => onOpenChange(false)}
                disabled={submitBusy}
              >
                Cancel
              </Button>
              <div className="relative min-w-0 sm:flex-1 sm:w-auto">
                <Button
                  type="submit"
                  form={WORKSPACE_DUPLICATE_TRACKER_FORM_ID}
                  disabled={
                    !canSubmitForm ||
                    submitBusy ||
                    selectors.manifestEmpty
                  }
                  className="relative h-9 min-w-0 w-full rounded-none border border-transparent"
                >
                  {submitBusy ? "Saving..." : "Create tracker"}
                </Button>
                {showUnchangedBlockedLayer ?
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Create tracker unavailable: change something from the duplicate first"
                    className="absolute inset-0 z-[1] cursor-not-allowed bg-transparent"
                    onClick={() =>
                      formRef.current?.signalUnchangedDuplicateAttempt()}
                  />
                : null}
              </div>
            </DialogFooter>
          </>
        : null}
      </DialogContent>
    </Dialog>
  );
}
