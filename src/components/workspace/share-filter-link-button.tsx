"use client";

import { useCallback, useState } from "react";
import { LinkSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";
import { buildDashboardShareUrl } from "@/lib/workspace/grid-filters-share";

interface ShareFilterLinkButtonProps {
  filters: GridFiltersJson;
  disabled?: boolean;
  className?: string;
}

export function ShareFilterLinkButton({
  filters,
  disabled = false,
  className,
}: ShareFilterLinkButtonProps) {
  const [copying, setCopying] = useState(false);

  const copyLink = useCallback(async () => {
    if (disabled || copying) return;
    setCopying(true);
    try {
      const url = buildDashboardShareUrl(window.location.origin, filters);
      await navigator.clipboard.writeText(url);
      toast.success("Link copied — share it to apply these filters.");
    } catch {
      toast.error("Could not copy link.");
    } finally {
      setCopying(false);
    }
  }, [copying, disabled, filters]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Copy link to filters"
          disabled={disabled || copying}
          className={className}
          onClick={() => void copyLink()}
        >
          <LinkSimple weight="duotone" className="size-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {disabled
          ? "Select a set, archetype, or tuning to share"
          : "Copy link to these filters"}
      </TooltipContent>
    </Tooltip>
  );
}
