"use client";

import { useCallback, useMemo, useState } from "react";
import { CaretDown, Plus, X } from "@phosphor-icons/react/dist/ssr";
import type { SavedFilterViewRow } from "@/lib/db/types";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";
import {
  isOwnedSavedView,
  useSavedViewsApi,
} from "@/lib/saved-views/use-saved-views-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SavedViewNameDialog,
  ShareViewDialog,
} from "@/components/workspace/saved-view-dialogs";
import { SavedViewRow } from "@/components/workspace/saved-view-row";
import { INLINE_TRIGGER_FRAME_CLASS } from "@/components/workspace/filter-bar-primitives";

const SAVED_VIEWS_SECTION_LABEL_CLASS =
  "pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

interface SavedViewsMenuProps {
  views: SavedFilterViewRow[];
  activeViewId: string | null;
  filters: GridFiltersJson;
  onViewsChange: (views: SavedFilterViewRow[]) => void;
  onApply: (view: SavedFilterViewRow) => void;
  onClearActive: () => void;
  className?: string;
}

export function SavedViewsMenu({
  views,
  activeViewId,
  filters,
  onViewsChange,
  onApply,
  onClearActive,
  className,
}: SavedViewsMenuProps) {
  const api = useSavedViewsApi(views, onViewsChange);

  const ownedViews = useMemo(
    () => views.filter((v) => isOwnedSavedView(v)),
    [views],
  );
  const sharedViews = useMemo(
    () => views.filter((v) => !isOwnedSavedView(v)),
    [views],
  );

  const activeView = useMemo(
    () => views.find((v) => v.id === activeViewId) ?? null,
    [activeViewId, views],
  );

  const [saveOpen, setSaveOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SavedFilterViewRow | null>(
    null,
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<SavedFilterViewRow | null>(
    null,
  );
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  const openRenameDialog = useCallback((view: SavedFilterViewRow) => {
    setRenameTarget(view);
    setRenameOpen(true);
  }, []);

  const openShareDialog = useCallback(
    async (view: SavedFilterViewRow) => {
      setShareTarget(view);
      setShareUrl(null);
      setShareOpen(true);
      setShareBusy(true);
      const url = await api.ensureShareLink(view);
      setShareUrl(url);
      setShareBusy(false);
      if (!url) setShareOpen(false);
    },
    [api],
  );

  const revokeShare = useCallback(async () => {
    if (!shareTarget) return;
    setShareBusy(true);
    const ok = await api.revokeShareLink(shareTarget);
    setShareBusy(false);
    if (ok) {
      setShareOpen(false);
      setShareUrl(null);
    }
  }, [api, shareTarget]);

  const triggerLabel = activeView?.name ?? "Views";

  return (
    <>
      <DropdownMenu modal={false}>
        <div className={INLINE_TRIGGER_FRAME_CLASS}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              aria-label="Saved views"
              className={cn(
                "group/saved-views-trigger h-9 shrink-0 gap-1.5 rounded-none px-3 text-xs focus-visible:ring-0 focus-visible:ring-offset-0",
                activeView
                  ? "border-primary/60 bg-primary/10 font-medium text-foreground hover:border-primary/70 hover:bg-primary/20 hover:text-foreground data-[state=open]:border-primary/60 data-[state=open]:bg-primary/10 data-[state=open]:text-foreground"
                  : "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
                className,
              )}
            >
              <span className="max-w-[10rem] truncate text-left">
                {triggerLabel}
              </span>
              {activeView ? (
                <span aria-hidden className="inline-block w-5 shrink-0" />
              ) : null}
              <CaretDown
                weight="duotone"
                aria-hidden
                className="!size-3.5 shrink-0 opacity-60 transition group-hover/saved-views-trigger:opacity-90 group-data-[state=open]/saved-views-trigger:rotate-180"
              />
            </Button>
          </DropdownMenuTrigger>
          {activeView ? (
            <button
              type="button"
              aria-label="Clear saved view"
              title="Clear saved view"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClearActive();
              }}
              className="group/clear pointer-events-auto absolute inset-y-0 right-8 z-10 flex w-5 items-center justify-center rounded-none border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:text-foreground focus-visible:outline-none"
            >
              <X
                weight="bold"
                aria-hidden
                className="!size-3.5 opacity-60 transition group-hover/clear:opacity-90"
              />
            </button>
          ) : null}
        </div>
        <DropdownMenuContent
          align="start"
          className="min-w-56 max-w-xs rounded-none py-1"
          collisionPadding={16}
        >
          <DropdownMenuLabel className={SAVED_VIEWS_SECTION_LABEL_CLASS}>
            Saved by you
          </DropdownMenuLabel>
          {ownedViews.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-muted-foreground/80">
              No saved views yet.
            </div>
          ) : null}
          {ownedViews.map((view) => (
            <SavedViewRow
              key={view.id}
              view={view}
              active={view.id === activeViewId}
              owned
              onApply={() => onApply(view)}
              onRename={() => openRenameDialog(view)}
              onShare={() => void openShareDialog(view)}
              onRevokeShare={
                view.share_slug
                  ? () => void api.revokeShareLink(view)
                  : undefined
              }
              onDelete={() => void api.deleteView(view)}
            />
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuLabel className={SAVED_VIEWS_SECTION_LABEL_CLASS}>
            Shared with you
          </DropdownMenuLabel>
          {sharedViews.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-muted-foreground/80">
              No shared views yet.
            </div>
          ) : null}
          {sharedViews.map((view) => (
            <SavedViewRow
              key={view.id}
              view={view}
              active={view.id === activeViewId}
              owned={false}
              onApply={() => onApply(view)}
              onDelete={() => void api.deleteView(view)}
            />
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="rounded-none"
            onSelect={(e) => {
              e.preventDefault();
              setSaveOpen(true);
            }}
          >
            <Plus weight="duotone" className="size-4" aria-hidden />
            Save current filters as view…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SavedViewNameDialog
        key="save"
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save view"
        description="Saves your current set, archetype, tuning, and tertiary filters. Class and search are not included."
        submitLabel="Save"
        busyLabel="Saving…"
        onSubmit={(name) => api.createView(name, filters)}
      />

      <SavedViewNameDialog
        key={renameTarget?.id ?? "rename"}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename view"
        initialName={renameTarget?.name ?? ""}
        submitLabel="Rename"
        busyLabel="Saving…"
        onSubmit={(name) =>
          renameTarget ? api.renameView(renameTarget, name) : Promise.resolve(false)
        }
      />

      <ShareViewDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        target={shareTarget}
        shareUrl={shareUrl}
        shareBusy={shareBusy}
        onRevoke={revokeShare}
      />
    </>
  );
}
