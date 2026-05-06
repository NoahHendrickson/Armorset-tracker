"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash } from "@phosphor-icons/react/dist/ssr";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ViewActionsProps {
  viewId: string;
  /**
   * Tracker surface variant — icons lay out vertically on the sidebar with a
   * dark hover state. Default = inline (legacy dropdown-style rendering).
   */
  layout?: "inline" | "sidebar";
}

/**
 * Delete affordance for a tracker. The `sidebar` layout matches the Figma
 * tracker toolbar; `inline` is the dashboard row layout.
 */
export function ViewActions({
  viewId,
  layout = "inline",
}: ViewActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function destroy() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/views/${viewId}`, {
        method: "DELETE",
        credentials: "include",
      });
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

  const triggers =
    layout === "sidebar" ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Delete tracker"
            onClick={() => setDeleteOpen(true)}
            className="flex h-5 w-5 items-center justify-center text-white/70 transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Trash weight="duotone" className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Delete tracker</TooltipContent>
      </Tooltip>
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete view"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash weight="duotone" className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete view</TooltipContent>
      </Tooltip>
    );

  return (
    <>
      {triggers}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-none sm:rounded-none">
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
