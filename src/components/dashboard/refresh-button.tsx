"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function RefreshButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function refresh() {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/inventory/sync?force=1", { method: "POST" });
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

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={refresh}
      disabled={isLoading}
      aria-label="Refresh inventory from Bungie"
    >
      <ArrowsClockwise className={isLoading ? "animate-spin" : ""} />
      <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
    </Button>
  );
}
