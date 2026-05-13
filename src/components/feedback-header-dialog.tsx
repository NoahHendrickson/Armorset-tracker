"use client";

import * as React from "react";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type FeedbackCategory = "bug" | "wishlist";

/**
 * Opens a modal to capture bug vs wishlist feedback; POSTs to `/api/feedback` (GitHub-backed).
 */
export function FeedbackHeaderDialog() {
  const [open, setOpen] = React.useState(false);
  const [tooltipOpen, setTooltipOpen] = React.useState(false);
  /** After closing the dialog, ignore tooltip opens until the trigger loses pointer (avoids instant re-show). */
  const suppressTooltipUntilLeaveRef = React.useRef(false);
  const [category, setCategory] = React.useState<FeedbackCategory | null>(null);
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const canSubmit =
    category !== null && message.trim().length > 0 && !sending;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setTooltipOpen(false);
    if (next) {
      suppressTooltipUntilLeaveRef.current = false;
    } else {
      suppressTooltipUntilLeaveRef.current = true;
      setMessage("");
      setCategory(null);
      setSending(false);
    }
  }

  async function submit() {
    const text = message.trim();
    if (!category || text.length === 0 || sending) return;
    setSending(true);
    try {
      const body = {
        category,
        message: text,
        pagePath:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      };
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(payload.error ?? "Could not submit feedback");
        return;
      }
      toast.success("Thanks — your feedback was sent.");
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit feedback");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip
        open={tooltipOpen}
        onOpenChange={(nextTip) => {
          if (nextTip && suppressTooltipUntilLeaveRef.current) return;
          setTooltipOpen(nextTip);
        }}
      >
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Send feedback"
              onPointerLeave={() => {
                suppressTooltipUntilLeaveRef.current = false;
              }}
            >
              <ChatCircleDots weight="duotone" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Feedback</TooltipContent>
      </Tooltip>
      <DialogContent className="rounded-none sm:rounded-none">
        <DialogHeader className="pb-4">
          <DialogTitle>Feedback</DialogTitle>
          <DialogDescription>
            Describe a bug or share a feature idea. Please be as detailed as possible.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          <div>
            <Label className="mb-[12px] block">
              Type<span className="ml-0.5 text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="Feedback type"
              aria-required="true"
            >
              <button
                type="button"
                role="radio"
                aria-checked={category === "bug"}
                disabled={sending}
                onClick={() => setCategory("bug")}
                className={cn(
                  "rounded-none border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
                  category === "bug"
                    ? "border-ring bg-accent text-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                Something broke
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={category === "wishlist"}
                disabled={sending}
                onClick={() => setCategory("wishlist")}
                className={cn(
                  "rounded-none border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
                  category === "wishlist"
                    ? "border-ring bg-accent text-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                Feature idea
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="feedback-message" className="mb-[12px] block">
              Details<span className="ml-0.5 text-destructive" aria-hidden>*</span>
            </Label>
            <textarea
              id="feedback-message"
              required
              aria-required="true"
              disabled={sending}
              placeholder="Steps to reproduce, what you expected…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className={cn(
                "flex min-h-[8rem] w-full rounded-none border px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[9rem]",
                "resize-y border-input bg-background text-foreground",
              )}
              maxLength={8000}
            />
            <p className="mt-2 text-xs text-muted-foreground">{message.length} / 8000</p>
          </div>
        </div>

        <DialogFooter className="w-full gap-2 sm:justify-start sm:gap-2 sm:space-x-0 sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="h-9 w-fit shrink-0 self-start"
            onClick={() => handleOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-9 min-w-0 w-full border border-transparent sm:flex-1 sm:w-auto"
            onClick={() => void submit()}
            disabled={!canSubmit}
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
