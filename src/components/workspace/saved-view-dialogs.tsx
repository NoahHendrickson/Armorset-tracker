"use client";

import { useState } from "react";
import { LinkSimple } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import type { SavedFilterViewRow } from "@/lib/db/types";
import { buildSavedFilterViewShareUrl } from "@/lib/saved-views/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface SavedViewNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialName?: string;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (name: string) => Promise<boolean>;
}

export function SavedViewNameDialog({
  open,
  onOpenChange,
  title,
  initialName = "",
  submitLabel,
  busyLabel,
  onSubmit,
}: SavedViewNameDialogProps) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (busy) return;
    setBusy(true);
    const ok = await onSubmit(name);
    setBusy(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) setName(initialName);
      }}
    >
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="View name"
          maxLength={80}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSubmit();
          }}
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-none"
            disabled={!name.trim() || busy}
            onClick={() => void handleSubmit()}
          >
            {busy ? busyLabel : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ShareViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: SavedFilterViewRow | null;
  shareUrl: string | null;
  shareBusy: boolean;
  onRevoke: () => Promise<void>;
}

export function ShareViewDialog({
  open,
  onOpenChange,
  target,
  shareUrl,
  shareBusy,
  onRevoke,
}: ShareViewDialogProps) {
  const displayUrl =
    shareUrl ??
    (shareBusy
      ? "Generating link…"
      : target?.share_slug
        ? buildSavedFilterViewShareUrl(
            typeof window !== "undefined" ? window.location.origin : "",
            target.share_slug,
          )
        : "");

  async function copyShareUrl() {
    if (!displayUrl || shareBusy) return;
    try {
      await navigator.clipboard.writeText(displayUrl);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy link.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share view</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            readOnly
            value={displayUrl}
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
            onClick={() => void onRevoke()}
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
  );
}
