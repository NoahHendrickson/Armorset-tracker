"use client";

import { DotsThreeVertical } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import type { SavedFilterViewRow } from "@/lib/db/types";
import { parseSavedFilterViewPayload } from "@/lib/saved-views/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SavedViewRowProps {
  view: SavedFilterViewRow;
  active: boolean;
  owned: boolean;
  onApply: () => void;
  onRename?: () => void;
  onShare?: () => void;
  onRevokeShare?: () => void;
  onDelete: () => void;
}

export function SavedViewRow({
  view,
  active,
  owned,
  onApply,
  onRename,
  onShare,
  onRevokeShare,
  onDelete,
}: SavedViewRowProps) {
  const payload = parseSavedFilterViewPayload(view.filters);

  return (
    <div className="group/row flex min-w-0 items-center gap-0.5 px-1">
      <DropdownMenuItem
        className={cn(
          "min-w-0 flex-1 cursor-pointer rounded-none",
          active && "bg-accent font-medium",
        )}
        onSelect={(e) => {
          e.preventDefault();
          if (!payload) {
            toast.error("This view has invalid saved data.");
            return;
          }
          onApply();
        }}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate">{view.name}</span>
          {!owned ? (
            <span className="truncate text-muted-foreground">
              from {view.source_display_name ?? "someone"}
            </span>
          ) : null}
        </span>
      </DropdownMenuItem>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${view.name}`}
            className="size-7 shrink-0 rounded-none opacity-70 group-hover/row:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <DotsThreeVertical
              weight="bold"
              className="size-3.5"
              aria-hidden
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-40 rounded-none py-1"
          collisionPadding={16}
        >
          {owned ? (
            <>
              <DropdownMenuItem
                className="rounded-none"
                onSelect={(e) => {
                  e.preventDefault();
                  onRename?.();
                }}
              >
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-none"
                onSelect={(e) => {
                  e.preventDefault();
                  onShare?.();
                }}
              >
                Get share link
              </DropdownMenuItem>
              {view.share_slug ? (
                <DropdownMenuItem
                  className="rounded-none"
                  onSelect={(e) => {
                    e.preventDefault();
                    onRevokeShare?.();
                  }}
                >
                  Revoke share link
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            className="rounded-none text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              onDelete();
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
