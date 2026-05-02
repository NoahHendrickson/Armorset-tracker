"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowsCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface RefreshButtonProps {
  /**
   * `button`      = outlined button with label (dashboards / older headers).
   * `icon`        = 20px icon-only trigger styled for the tracker sidebar.
   * `header-icon` = 40px icon button styled for the top app header.
   * `header-large` = compact square nav control (inventory refresh).
   * `fab`         = circular floating-action icon for the canvas bottom bar.
   */
  variant?: "button" | "icon" | "header-icon" | "header-large" | "fab";
}

export function RefreshButton({
  variant = "button",
}: RefreshButtonProps = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function refresh() {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/inventory/sync?force=1", {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json()) as { error?: string; itemCount?: number };
      if (!res.ok) {
        toast.error(body.error ?? "Refresh failed");
        return;
      }
      toast.success(
        `Inventory refreshed${typeof body.itemCount === "number" ? ` — ${body.itemCount} pieces` : ""}.`,
      );
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setIsLoading(false);
    }
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={refresh}
        disabled={isLoading}
        aria-label={
          isLoading ? "Refreshing inventory" : "Refresh inventory from Bungie"
        }
        className="flex h-5 w-5 items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60"
      >
        <ArrowsCounterClockwise
          weight="duotone"
          className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
        />
      </button>
    );
  }

  if (variant === "header-icon") {
    return (
      <button
        type="button"
        onClick={refresh}
        disabled={isLoading}
        aria-label={
          isLoading ? "Refreshing inventory" : "Refresh inventory from Bungie"
        }
        title="Refresh inventory"
        className="flex h-10 w-10 items-center justify-center border border-white/10 bg-white/5 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60"
      >
        <ArrowsCounterClockwise
          weight="duotone"
          className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
        />
      </button>
    );
  }

  if (variant === "header-large") {
    return (
      <button
        type="button"
        onClick={refresh}
        disabled={isLoading}
        aria-label={
          isLoading ? "Refreshing inventory" : "Refresh inventory from Bungie"
        }
        title="Refresh inventory"
        className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/10 bg-[#2d2e32] text-white/80 shadow-lg transition-colors hover:bg-[#3a3b3f] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60"
      >
        <ArrowsCounterClockwise
          weight="duotone"
          className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
        />
      </button>
    );
  }

  if (variant === "fab") {
    return (
      <button
        type="button"
        onClick={refresh}
        disabled={isLoading}
        aria-label={
          isLoading ? "Refreshing inventory" : "Refresh inventory from Bungie"
        }
        title="Refresh inventory"
        className="flex h-12 w-12 shrink-0 items-center justify-center border border-white/10 bg-[#2d2e32] text-white/80 shadow-lg transition-colors hover:bg-[#3a3b3f] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60"
      >
        <ArrowsCounterClockwise
          weight="duotone"
          className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
        />
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={refresh}
      disabled={isLoading}
      aria-label="Refresh inventory from Bungie"
    >
      <ArrowsCounterClockwise
        weight="duotone"
        className={isLoading ? "animate-spin" : ""}
      />
      <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
    </Button>
  );
}
