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
import { chromeStandaloneSquareIconButtonClass } from "@/components/ui/chrome-square-icon-button";
import { cn } from "@/lib/utils";

type FeedbackCategory = "bug" | "wishlist";

/**
 * Opens a modal to capture bug vs wishlist feedback; POSTs to `/api/feedback` (GitHub-backed).
 */
export function FeedbackHeaderDialog() {
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<FeedbackCategory>("bug");
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);

  async function submit() {
    const text = message.trim();
    if (text.length === 0 || sending) return;
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
      setOpen(false);
      setMessage("");
      setCategory("bug");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit feedback");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Send feedback"
          title="Feedback"
          className={chromeStandaloneSquareIconButtonClass()}
        >
          <ChatCircleDots weight="duotone" className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="border-[color:var(--border)] bg-[#2e2f2f] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Feedback</DialogTitle>
          <DialogDescription className="text-white/70">
            Describe a bug or share a feature idea. Signed-in Bungie profiles only;
            submissions are routed to maintainer tools (no GitHub login required).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="space-y-2">
            <Label className="text-white">Type</Label>
            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="Feedback type"
            >
              <button
                type="button"
                role="radio"
                aria-checked={category === "bug"}
                disabled={sending}
                onClick={() => setCategory("bug")}
                className={cn(
                  "rounded-none border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 sm:text-sm",
                  category === "bug"
                    ? "border-white/40 bg-white/[0.12] text-white"
                    : "border-white/10 bg-transparent text-white/75 hover:bg-white/[0.06]",
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
                  "rounded-none border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 sm:text-sm",
                  category === "wishlist"
                    ? "border-white/40 bg-white/[0.12] text-white"
                    : "border-white/10 bg-transparent text-white/75 hover:bg-white/[0.06]",
                )}
              >
                Feature idea
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-message" className="text-white">
              Details
            </Label>
            <textarea
              id="feedback-message"
              disabled={sending}
              placeholder="Steps to reproduce, what you expected…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className={cn(
                "flex min-h-[8rem] w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-white/35 focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[9rem]",
                "resize-y border-white/15 bg-black/25 text-white",
              )}
              maxLength={8000}
            />
            <p className="text-xs text-white/55">{message.length} / 8000</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={sending}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
