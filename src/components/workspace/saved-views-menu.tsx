"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CaretDown,
  DotsThreeVertical,
  LinkSimple,
  Plus,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import type { SavedFilterViewRow } from "@/lib/db/types";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";
import {
  buildSavedFilterViewShareUrl,
  payloadFromGridFilters,
  parseSavedFilterViewPayload,
} from "@/lib/saved-views/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

function isOwnedView(view: SavedFilterViewRow): boolean {
  return view.source_user_id === null;
}

/** Same styling as the "Pinned sets" section label in armor-set-combobox. */
const SAVED_VIEWS_SECTION_LABEL_CLASS =
  "pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

/** Matches `INLINE_TRIGGER_FRAME_CLASS` in tracker-filter-bar. */
const SAVED_VIEWS_TRIGGER_FRAME_CLASS =
  "relative isolate shrink-0 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background";

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
  const ownedViews = useMemo(
    () => views.filter((v) => isOwnedView(v)),
    [views],
  );
  const sharedViews = useMemo(
    () => views.filter((v) => !isOwnedView(v)),
    [views],
  );

  const activeView = useMemo(
    () => views.find((v) => v.id === activeViewId) ?? null,
    [activeViewId, views],
  );

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SavedFilterViewRow | null>(
    null,
  );
  const [renameName, setRenameName] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<SavedFilterViewRow | null>(
    null,
  );
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  const openSaveDialog = useCallback(() => {
    setSaveName("");
    setSaveOpen(true);
  }, []);

  const openRenameDialog = useCallback((view: SavedFilterViewRow) => {
    setRenameTarget(view);
    setRenameName(view.name);
    setRenameOpen(true);
  }, []);

  const openShareDialog = useCallback(async (view: SavedFilterViewRow) => {
    setShareTarget(view);
    setShareUrl(null);
    setShareOpen(true);
    setShareBusy(true);
    try {
      const res = await fetch(`/api/saved-views/${view.id}/share`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Share failed (${res.status})`);
      }
      const body = (await res.json()) as { slug: string; url: string };
      setShareUrl(body.url);
      onViewsChange(
        views.map((v) =>
          v.id === view.id ? { ...v, share_slug: body.slug } : v,
        ),
      );
    } catch (err) {
      setShareOpen(false);
      toast.error(
        err instanceof Error ? err.message : "Could not create share link.",
      );
    } finally {
      setShareBusy(false);
    }
  }, [onViewsChange, views]);

  const handleSave = useCallback(async () => {
    const trimmed = saveName.trim();
    if (!trimmed || saveBusy) return;
    setSaveBusy(true);
    try {
      const res = await fetch("/api/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          filters: payloadFromGridFilters(filters),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }
      const body = (await res.json()) as { view: SavedFilterViewRow };
      onViewsChange(
        [...views, body.view].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSaveOpen(false);
      toast.success("View saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save view.");
    } finally {
      setSaveBusy(false);
    }
  }, [filters, onViewsChange, saveBusy, saveName, views]);

  const handleRename = useCallback(async () => {
    if (!renameTarget) return;
    const trimmed = renameName.trim();
    if (!trimmed || renameBusy) return;
    setRenameBusy(true);
    try {
      const res = await fetch(`/api/saved-views/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Rename failed (${res.status})`);
      }
      const body = (await res.json()) as { view: SavedFilterViewRow };
      onViewsChange(
        views
          .map((v) => (v.id === body.view.id ? body.view : v))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setRenameOpen(false);
      toast.success("View renamed.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not rename view.",
      );
    } finally {
      setRenameBusy(false);
    }
  }, [onViewsChange, renameBusy, renameName, renameTarget, views]);

  const handleDelete = useCallback(
    async (view: SavedFilterViewRow) => {
      try {
        const res = await fetch(`/api/saved-views/${view.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? `Delete failed (${res.status})`);
        }
        onViewsChange(views.filter((v) => v.id !== view.id));
        toast.success(
          isOwnedView(view) ? "View deleted." : "Removed from your list.",
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not delete view.",
        );
      }
    },
    [onViewsChange, views],
  );

  const revokeShareForView = useCallback(
    async (view: SavedFilterViewRow, closeDialog = false) => {
      setShareBusy(true);
      try {
        const res = await fetch(`/api/saved-views/${view.id}/share`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? `Revoke failed (${res.status})`);
        }
        onViewsChange(
          views.map((v) => (v.id === view.id ? { ...v, share_slug: null } : v)),
        );
        if (closeDialog) {
          setShareOpen(false);
          setShareUrl(null);
        }
        toast.success("Share link revoked.");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not revoke share link.",
        );
      } finally {
        setShareBusy(false);
      }
    },
    [onViewsChange, views],
  );

  async function copyShareUrl() {
    const url =
      shareUrl ??
      (shareTarget?.share_slug
        ? buildSavedFilterViewShareUrl(
            window.location.origin,
            shareTarget.share_slug,
          )
        : null);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy link.");
    }
  }

  const triggerLabel = activeView?.name ?? "Views";

  return (
    <>
      <DropdownMenu modal={false}>
        <div className={SAVED_VIEWS_TRIGGER_FRAME_CLASS}>
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
              onApply={() => onApply(view)}
              owned
              onRename={() => openRenameDialog(view)}
              onShare={() => void openShareDialog(view)}
              onRevokeShare={
                view.share_slug
                  ? () => void revokeShareForView(view)
                  : undefined
              }
              onDelete={() => void handleDelete(view)}
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
              onApply={() => onApply(view)}
              owned={false}
              onDelete={() => void handleDelete(view)}
            />
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="rounded-none"
            onSelect={(e) => {
              e.preventDefault();
              openSaveDialog();
            }}
          >
            <Plus weight="duotone" className="size-4" aria-hidden />
            Save current filters as view…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
            <DialogDescription>
              Saves your current set, archetype, tuning, and tertiary filters.
              Class and search are not included.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="View name"
            maxLength={80}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
            }}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => setSaveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-none"
              disabled={!saveName.trim() || saveBusy}
              onClick={() => void handleSave()}
            >
              {saveBusy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename view</DialogTitle>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            placeholder="View name"
            maxLength={80}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRename();
            }}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-none"
              disabled={!renameName.trim() || renameBusy}
              onClick={() => void handleRename()}
            >
              {renameBusy ? "Saving…" : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share view</DialogTitle>
            <DialogDescription>
              Anyone with this link can add a snapshot to their dashboard after
              signing in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              readOnly
              value={
                shareUrl ??
                (shareBusy
                  ? "Generating link…"
                  : shareTarget?.share_slug
                    ? buildSavedFilterViewShareUrl(
                        typeof window !== "undefined"
                          ? window.location.origin
                          : "",
                        shareTarget.share_slug,
                      )
                    : "")
              }
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 rounded-none"
              aria-label="Copy share link"
              disabled={shareBusy || !shareUrl}
              onClick={() => void copyShareUrl()}
            >
              <LinkSimple weight="duotone" className="size-4" aria-hidden />
            </Button>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              className="rounded-none"
              disabled={shareBusy}
              onClick={() => {
                if (shareTarget) void revokeShareForView(shareTarget, true);
              }}
            >
              Revoke link
            </Button>
            <Button
              type="button"
              className="rounded-none"
              disabled={shareBusy || !shareUrl}
              onClick={() => void copyShareUrl()}
            >
              Copy link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SavedViewRow({
  view,
  active,
  owned,
  onApply,
  onRename,
  onShare,
  onRevokeShare,
  onDelete,
}: {
  view: SavedFilterViewRow;
  active: boolean;
  owned: boolean;
  onApply: () => void;
  onRename?: () => void;
  onShare?: () => void;
  onRevokeShare?: () => void;
  onDelete: () => void;
}) {
  const payload = parseSavedFilterViewPayload(view.filters);

  return (
    <div className="group/row flex min-w-0 items-center gap-0.5 px-1">
      <DropdownMenuItem
        className={cn(
          "min-w-0 flex-1 cursor-pointer rounded-none",
          active && "bg-accent font-medium",
        )}
        onSelect={(e) => {
          e.preventDefault();
          if (!payload) {
            toast.error("This view has invalid saved data.");
            return;
          }
          onApply();
        }}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate">{view.name}</span>
          {!owned ? (
            <span className="truncate text-muted-foreground">
              from {view.source_display_name ?? "someone"}
            </span>
          ) : null}
        </span>
      </DropdownMenuItem>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${view.name}`}
            className="size-7 shrink-0 rounded-none opacity-70 group-hover/row:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <DotsThreeVertical
              weight="bold"
              className="size-3.5"
              aria-hidden
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-40 rounded-none py-1"
          collisionPadding={16}
        >
          {owned ? (
            <>
              <DropdownMenuItem
                className="rounded-none"
                onSelect={(e) => {
                  e.preventDefault();
                  onRename?.();
                }}
              >
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-none"
                onSelect={(e) => {
                  e.preventDefault();
                  onShare?.();
                }}
              >
                Get share link
              </DropdownMenuItem>
              {view.share_slug ? (
                <DropdownMenuItem
                  className="rounded-none"
                  onSelect={(e) => {
                    e.preventDefault();
                    onRevokeShare?.();
                  }}
                >
                  Revoke share link
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            className="rounded-none text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              onDelete();
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

