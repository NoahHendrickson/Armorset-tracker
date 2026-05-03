"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowsClockwise, Database } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { chromeStandaloneSquareIconButtonClass } from "@/components/ui/chrome-square-icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  /**
   * `primary`/`secondary` = text + icon button (dashboard banners).
   * `header-icon`         = same bordered 40×40 chrome as `header-large`.
   * `header-large`        = compact square nav control (manifest sync).
   */
  variant?: "primary" | "secondary" | "header-icon" | "header-large";
  label?: string;
}

export function SyncManifestButton({
  variant = "primary",
  label = "Sync manifest",
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function sync() {
    if (isLoading) return;
    setIsLoading(true);
    const toastId = toast.loading("Syncing Bungie manifest…");
    try {
      const res = await fetch("/api/admin/manifest/sync?force=1", {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json()) as {
        error?: string;
        maintenance?: boolean;
        version?: string;
        skipped?: boolean;
      };
      if (!res.ok) {
        if (body.maintenance) {
          toast.error("Bungie API is in maintenance. Try again later.", {
            id: toastId,
          });
        } else {
          toast.error(body.error ?? "Manifest sync failed", { id: toastId });
        }
        return;
      }
      toast.success(
        body.skipped
          ? "Manifest already up to date."
          : `Manifest synced${body.version ? ` (${body.version.slice(0, 8)}…)` : ""}.`,
        { id: toastId },
      );
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Manifest sync failed", {
        id: toastId,
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (variant === "header-icon") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={sync}
            disabled={isLoading}
            aria-label={
              isLoading ? "Syncing Bungie manifest" : "Sync Bungie manifest"
            }
            className={chromeStandaloneSquareIconButtonClass()}
          >
            {isLoading ? (
              <ArrowsClockwise weight="duotone" className="h-5 w-5 animate-spin" />
            ) : (
              <Database weight="duotone" className="h-5 w-5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {isLoading ? "Syncing manifest…" : "Sync Bungie manifest"}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (variant === "header-large") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={sync}
            disabled={isLoading}
            aria-label={
              isLoading ? "Syncing Bungie manifest" : "Sync Bungie manifest"
            }
            className={chromeStandaloneSquareIconButtonClass()}
          >
            {isLoading ? (
              <ArrowsClockwise weight="duotone" className="h-5 w-5 animate-spin" />
            ) : (
              <Database weight="duotone" className="h-5 w-5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {isLoading ? "Syncing manifest…" : "Sync Bungie manifest"}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant={variant === "primary" ? "default" : "outline"}
      size="sm"
      onClick={sync}
      disabled={isLoading}
      aria-label="Sync Bungie manifest"
    >
      {isLoading ? (
        <ArrowsClockwise weight="duotone" className="animate-spin" />
      ) : (
        <Database weight="duotone" />
      )}
      <span>{isLoading ? "Syncing…" : label}</span>
    </Button>
  );
}
