"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, Trash } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ViewActionsProps {
  viewId: string;
  initialName: string;
  /**
   * Tracker surface variant — icons lay out vertically on the sidebar with a
   * dark hover state. Default = inline (legacy dropdown-style rendering).
   */
  layout?: "inline" | "sidebar";
}

/**
 * Exposes rename + delete affordances for a view. The `sidebar` layout matches
 * the Figma tracker toolbar (two icon buttons stacked under the drag handle +
 * refresh); `inline` is the dashboard row layout.
 */
export function ViewActions({
  viewId,
  initialName,
  layout = "inline",
}: ViewActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);

  async function rename() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/views/${viewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Rename failed");
        return;
      }
      toast.success("Renamed");
      setRenameOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function destroy() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/views/${viewId}`, { method: "DELETE" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Delete failed");
        return;
      }
      toast.success("View deleted");
      setDeleteOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSubmitting(false);
    }
  }

  const openRename = () => {
    setName(initialName);
    setRenameOpen(true);
  };

  const triggers =
    layout === "sidebar" ? (
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          aria-label="Rename tracker"
          onClick={openRename}
          className="flex h-5 w-5 items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <PencilSimple weight="duotone" className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Delete tracker"
          onClick={() => setDeleteOpen(true)}
          className="flex h-5 w-5 items-center justify-center text-white/70 transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <Trash weight="duotone" className="h-5 w-5" />
        </button>
      </div>
    ) : (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Rename view"
          onClick={openRename}
        >
          <PencilSimple weight="duotone" className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete view"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash weight="duotone" className="h-4 w-4" />
        </Button>
      </div>
    );

  return (
    <>
      {triggers}

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename view</DialogTitle>
            <DialogDescription>
              Pick something memorable. Up to 80 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="rename-name">Name</Label>
            <Input
              id="rename-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={rename}
              disabled={!name.trim() || submitting || isPending}
            >
              {submitting || isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this view?</DialogTitle>
            <DialogDescription>
              This only deletes the saved view from your dashboard. Your Bungie
              inventory is untouched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={destroy}
              disabled={submitting || isPending}
            >
              {submitting || isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
