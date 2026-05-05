"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverClose = PopoverPrimitive.Close;

const PopoverPortal = PopoverPrimitive.Portal;

const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    /** Portal mount node (defaults to `document.body`). Use a parent modal node so nested pickers scroll under react-remove-scroll. */
    container?: HTMLElement | null;
  }
>(({ className, align = "center", sideOffset = 4, container, ...props }, ref) => (
  <PopoverPortal container={container ?? undefined}>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-[70] w-[min(calc(100vw-2rem),26rem)] max-h-[min(90vh,720px)] overflow-y-auto rounded-none border bg-popover p-4 text-popover-foreground shadow-lg outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </PopoverPortal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverPortal, PopoverAnchor, PopoverTrigger, PopoverContent, PopoverClose };
