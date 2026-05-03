"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Panel + arrow tail — single source of truth; darker than canvas `#1a1b1b`. */
const TOOLTIP_BG = "#121313";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 8, children, style, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-[200] max-w-[min(22rem,calc(100vw-1.5rem))] overflow-visible rounded-none px-3 py-2 text-left text-xs font-medium leading-snug text-white shadow-xl outline-none",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1",
        className,
      )}
      style={{ backgroundColor: TOOLTIP_BG, ...style }}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow
        width={12}
        height={6}
        style={{ fill: TOOLTIP_BG }}
      />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/** Wrap the app (or canvas subtree) once so trackers/header share tooltip UX. */
export function TooltipAppShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={220} skipDelayDuration={120}>
      {children}
    </TooltipProvider>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
