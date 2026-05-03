"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowsCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import {
  BUNGIE_REAUTH_REQUIRED_CODE,
  BUNGIE_RECONNECT_PATH,
  BUNGIE_REAUTH_USER_MESSAGE,
} from "@/lib/auth/bungie-reauth";
import { Button } from "@/components/ui/button";
import { chromeStandaloneSquareIconButtonClass } from "@/components/ui/chrome-square-icon-button";

interface RefreshButtonProps {
  /**
   * `button`      = outlined button with label (dashboards / older headers).
   * `icon`        = 20px icon-only trigger styled for the tracker sidebar.
   * `header-icon` = same bordered 40×40 chrome as `header-large` (kept for API compatibility).
   * `header-large` = compact square nav control (inventory refresh).
   */
  variant?: "button" | "icon" | "header-icon" | "header-large";
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
      const body = (await res.json()) as {
        error?: string;
        code?: string;
        reconnectPath?: string;
        itemCount?: number;
        warnings?: string[];
        equipmentOnlyRestricted?: boolean;
      };
      if (!res.ok) {
        if (body.code === BUNGIE_REAUTH_REQUIRED_CODE) {
          toast.error(body.error ?? BUNGIE_REAUTH_USER_MESSAGE, {
            duration: 22_000,
            action: {
              label: "Reconnect Bungie",
              onClick: () => {
                window.location.href =
                  body.reconnectPath ?? BUNGIE_RECONNECT_PATH;
              },
            },
          });
        } else {
          toast.error(body.error ?? "Refresh failed");
        }
        return;
      }

      if (body.equipmentOnlyRestricted) {
        const detail =
          Array.isArray(body.warnings) && body.warnings[0]
            ? body.warnings[0]
            : "Bungie only returned equipped armor. Reconnect Bungie so your session can read your full vault and inventories.";
        toast.error(detail, {
          duration: 22_000,
          action: {
            label: "Reconnect Bungie",
            onClick: () => {
              window.location.href = BUNGIE_RECONNECT_PATH;
            },
          },
        });
      } else {
        toast.success(
          `Inventory refreshed${typeof body.itemCount === "number" ? ` — ${body.itemCount} pieces` : ""}.`,
        );
        if (Array.isArray(body.warnings)) {
          for (const w of body.warnings) {
            toast.warning(w, { duration: 14_000 });
          }
        }
      }

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
        className={chromeStandaloneSquareIconButtonClass()}
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
        className={chromeStandaloneSquareIconButtonClass()}
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
